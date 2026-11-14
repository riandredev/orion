#![cfg_attr(windows, windows_subsystem = "windows")]

mod hash;
mod protocol;
mod raster;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use hash::pixel_grid;
use image::RgbaImage;
use protocol::{motion_kind, Command, DisplaySpec, SlideSpec};
use raster::{raster_slide, Fonts};
use winit::application::ApplicationHandler;
use winit::dpi::{PhysicalPosition, PhysicalSize};
use winit::event::WindowEvent;
use winit::event_loop::{ActiveEventLoop, EventLoop};
use winit::platform::windows::WindowAttributesExtWindows;
use winit::window::{Window, WindowId, WindowLevel};

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Uni {
    progress: f32,
    kind: u32,
    screen_aspect: f32,
    opacity: f32,
    cols: f32,
    rows: f32,
    seed: f32,
    fit: f32,
    prev_aspect: f32,
    next_aspect: f32,
    prev_framed: f32,
    next_framed: f32,
}

struct Gpu {
    device: wgpu::Device,
    queue: wgpu::Queue,
    format: wgpu::TextureFormat,
    pipeline: wgpu::RenderPipeline,
    layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
    blank: wgpu::TextureView,
    alpha: wgpu::CompositeAlphaMode,
}

struct Layer {
    key: String,
    kind: u32,
    duration: f32,
    started: Instant,
    seed: f32,
    prev_aspect: f32,
    next_aspect: f32,
    prev_framed: f32,
    next_framed: f32,
    fit: f32,
    prev: wgpu::TextureView,
    next: wgpu::TextureView,
    uniform: wgpu::Buffer,
}

struct Output {
    window: Arc<Window>,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    display_id: i64,
    shown: bool,
    base: Layer,
    overlay: Option<Layer>,
}

struct App {
    gpu: Option<Gpu>,
    outputs: HashMap<WindowId, Output>,
    fonts: Option<Fonts>,
    base: Option<SlideSpec>,
    overlay: Option<SlideSpec>,
}

impl App {
    fn new() -> Self {
        Self {
            gpu: None,
            outputs: HashMap::new(),
            fonts: Fonts::load(),
            base: None,
            overlay: None,
        }
    }

    fn ensure_gpu(&mut self, instance: &wgpu::Instance, surface: &wgpu::Surface<'_>) -> bool {
        if self.gpu.is_some() {
            return true;
        }
        let Some(adapter) = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: Some(surface),
            force_fallback_adapter: false,
        })) else {
            eprintln!("orion-output: no GPU adapter");
            return false;
        };
        let (device, queue) = match pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: Some("orion-output"),
            required_features: wgpu::Features::empty(),
            required_limits: wgpu::Limits::default(),
            memory_hints: wgpu::MemoryHints::MemoryUsage,
        }, None)) {
            Ok(pair) => pair,
            Err(err) => {
                eprintln!("orion-output: device: {err}");
                return false;
            }
        };
        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|format| format.is_srgb())
            .unwrap_or(caps.formats[0]);
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("transition"),
            source: wgpu::ShaderSource::Wgsl(include_str!("transition.wgsl").into()),
        });
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                tex_entry(0),
                tex_entry(1),
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: None,
            bind_group_layouts: &[&layout],
            push_constant_ranges: &[],
        });
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("transition"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs"),
                buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs"),
                targets: &[Some(wgpu::ColorTargetState {
                    format,
                    blend: Some(wgpu::BlendState::REPLACE),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let blank_image = RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 0, 255]));
        let blank = upload(&device, &queue, &blank_image).1;
        let alpha = caps.alpha_modes[0];
        self.gpu = Some(Gpu { device, queue, format, pipeline, layout, sampler, blank, alpha });
        true
    }

    fn configure(&mut self, event_loop: &ActiveEventLoop, displays: Vec<DisplaySpec>) {
        let same = displays.len() == self.outputs.len()
            && displays.iter().all(|spec| self.outputs.values().any(|output| output.display_id == spec.id));
        if same {
            self.rebuild();
            return;
        }
        self.outputs.clear();
        let instance = gpu_instance();
        for spec in displays {
            if spec.width == 0 || spec.height == 0 {
                continue;
            }
            let monitor = event_loop.available_monitors().min_by_key(|monitor| {
                let pos = monitor.position();
                (pos.x - spec.x).abs() + (pos.y - spec.y).abs()
            });
            let Some(monitor) = monitor else { continue };
            let position = monitor.position();
            let monitor_size = monitor.size();
            let attrs = Window::default_attributes()
                .with_title("Orion Output")
                .with_decorations(false)
                .with_resizable(false)
                .with_visible(false)
                .with_skip_taskbar(true)
                .with_position(PhysicalPosition::new(position.x, position.y))
                .with_inner_size(PhysicalSize::new(monitor_size.width.max(1), monitor_size.height.max(1)))
                .with_window_level(WindowLevel::AlwaysOnTop);
            let Ok(window) = event_loop.create_window(attrs) else { continue };
            window.set_cursor_visible(false);
            let window = Arc::new(window);
            let Ok(surface) = instance.create_surface(window.clone()) else { continue };
            if !self.ensure_gpu(&instance, &surface) {
                return;
            }
            let gpu = self.gpu.as_ref().unwrap();
            let size = monitor_size;
            let config = wgpu::SurfaceConfiguration {
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                format: gpu.format,
                width: size.width.max(1),
                height: size.height.max(1),
                present_mode: wgpu::PresentMode::Fifo,
                alpha_mode: gpu.alpha,
                view_formats: vec![],
                desired_maximum_frame_latency: 2,
            };
            surface.configure(&gpu.device, &config);
            let base = blank_layer(gpu);
            let id = window.id();
            self.outputs.insert(id, Output { window, surface, config, display_id: spec.id, shown: false, base, overlay: None });
        }
        self.rebuild();
    }

    fn rebuild(&mut self) {
        let Some(gpu) = self.gpu.as_ref() else { return };
        let fonts = self.fonts.as_ref();
        let base_spec = self.base.clone();
        let overlay_spec = self.overlay.clone();
        let ids: Vec<WindowId> = self.outputs.keys().copied().collect();
        for id in ids {
            let Some(output) = self.outputs.get_mut(&id) else { continue };
            let size = output.config.width.max(1);
            let height = output.config.height.max(1);
            if let Some(spec) = &base_spec {
                assign_layer(gpu, fonts, &mut output.base, spec, size, height);
            }
            match &overlay_spec {
                Some(spec) => {
                    let mut layer = output.overlay.take().unwrap_or_else(|| blank_layer(gpu));
                    assign_layer(gpu, fonts, &mut layer, spec, size, height);
                    output.overlay = Some(layer);
                }
                None => output.overlay = None,
            }
            output.window.request_redraw();
        }
    }

    fn render(&mut self, id: WindowId) {
        let already = {
        let Some(gpu) = self.gpu.as_ref() else { return };
        let Some(output) = self.outputs.get(&id) else { return };
        let frame = match output.surface.get_current_texture() {
            Ok(frame) => frame,
            Err(wgpu::SurfaceError::Lost) | Err(wgpu::SurfaceError::Outdated) => {
                output.surface.configure(&gpu.device, &output.config);
                return;
            }
            Err(_) => return,
        };
        let view = frame.texture.create_view(&Default::default());
        let mut encoder = gpu.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: None,
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_pipeline(&gpu.pipeline);
            let now = Instant::now();
            let aspect = output.config.width as f32 / output.config.height.max(1) as f32;
            draw_layer(&mut pass, gpu, &output.base, aspect, 1.0, now);
            if let Some(overlay) = &output.overlay {
                draw_layer(&mut pass, gpu, overlay, aspect, 1.0, now);
            }
        }
        gpu.queue.submit(Some(encoder.finish()));
        frame.present();
        output.shown
        };
        if !already {
            if let Some(output) = self.outputs.get_mut(&id) {
                output.shown = true;
                output.window.set_visible(true);
            }
        }
    }

    fn animating(&self) -> bool {
        let now = Instant::now();
        self.outputs.values().any(|output| {
            layer_live(&output.base, now) || output.overlay.as_ref().is_some_and(|layer| layer_live(layer, now))
        })
    }
}

fn layer_live(layer: &Layer, now: Instant) -> bool {
    layer.kind != 0 && layer.duration > 0.0 && now.duration_since(layer.started).as_secs_f32() < layer.duration
}

fn blank_layer(gpu: &Gpu) -> Layer {
    Layer {
        key: String::new(),
        kind: 0,
        duration: 0.0,
        started: Instant::now(),
        seed: 0.0,
        prev_aspect: 1.0,
        next_aspect: 1.0,
        prev_framed: 1.0,
        next_framed: 1.0,
        fit: 0.0,
        prev: gpu.blank.clone(),
        next: gpu.blank.clone(),
        uniform: gpu.device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: std::mem::size_of::<Uni>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        }),
    }
}

fn assign_layer(gpu: &Gpu, fonts: Option<&Fonts>, layer: &mut Layer, spec: &SlideSpec, width: u32, height: u32) {
    let key = spec.content_key();
    if layer.key == key {
        return;
    }
    let image = raster_slide(spec, width, height, fonts);
    let (_texture, view) = upload(&gpu.device, &gpu.queue, &image.image);
    layer.prev = layer.next.clone();
    layer.prev_aspect = layer.next_aspect;
    layer.prev_framed = layer.next_framed;
    layer.next = view;
    layer.next_aspect = image.aspect;
    layer.next_framed = if image.framed { 1.0 } else { 0.0 };
    layer.fit = if spec.fit == "cover" { 1.0 } else { 0.0 };
    layer.key = key;
    layer.kind = motion_kind(&spec.animation);
    layer.duration = if layer.kind == 0 { 0.0 } else { spec.duration_ms as f32 / 1000.0 };
    layer.started = Instant::now();
    layer.seed = (Instant::now().elapsed().as_nanos() % 65536) as f32;
    let _ = pixel_grid(width, height);
}

fn draw_layer(
    pass: &mut wgpu::RenderPass<'_>,
    gpu: &Gpu,
    layer: &Layer,
    aspect: f32,
    opacity: f32,
    now: Instant,
) {
    let raw = if layer.duration <= 0.0 {
        1.0
    } else {
        (now.duration_since(layer.started).as_secs_f32() / layer.duration).clamp(0.0, 1.0)
    };
    let progress = if layer.kind == 10 || layer.kind == 11 { raw } else { css_ease(raw) };
    let (cols, rows) = pixel_grid(1920, 1080);
    let uni = Uni {
        progress,
        kind: if raw >= 1.0 { 0 } else { layer.kind },
        screen_aspect: aspect,
        opacity,
        cols: cols as f32,
        rows: rows as f32,
        seed: layer.seed,
        fit: layer.fit,
        prev_aspect: layer.prev_aspect,
        next_aspect: layer.next_aspect,
        prev_framed: layer.prev_framed,
        next_framed: layer.next_framed,
    };
    gpu.queue.write_buffer(&layer.uniform, 0, bytemuck::bytes_of(&uni));
    let buffer = &layer.uniform;
    let bind = gpu.device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: None,
        layout: &gpu.layout,
        entries: &[
            wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&layer.prev) },
            wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&layer.next) },
            wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&gpu.sampler) },
            wgpu::BindGroupEntry { binding: 3, resource: buffer.as_entire_binding() },
        ],
    });
    pass.set_bind_group(0, &bind, &[]);
    pass.draw(0..3, 0..1);
}

fn upload(device: &wgpu::Device, queue: &wgpu::Queue, image: &RgbaImage) -> (wgpu::Texture, wgpu::TextureView) {
    let (width, height) = image.dimensions();
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8UnormSrgb,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    queue.write_texture(
        wgpu::ImageCopyTexture {
            texture: &texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        image,
        wgpu::ImageDataLayout {
            offset: 0,
            bytes_per_row: Some(4 * width),
            rows_per_image: Some(height),
        },
        wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
    );
    let view = texture.create_view(&Default::default());
    (texture, view)
}

fn tex_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::FRAGMENT,
        ty: wgpu::BindingType::Texture {
            sample_type: wgpu::TextureSampleType::Float { filterable: true },
            view_dimension: wgpu::TextureViewDimension::D2,
            multisampled: false,
        },
        count: None,
    }
}

fn gpu_instance() -> &'static wgpu::Instance {
    use std::sync::OnceLock;
    static INSTANCE: OnceLock<wgpu::Instance> = OnceLock::new();
    INSTANCE.get_or_init(|| {
        wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        })
    })
}

fn css_ease(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    let bez = |t: f32, c1: f32, c2: f32| {
        let u = 1.0 - t;
        3.0 * u * u * t * c1 + 3.0 * u * t * t * c2 + t * t * t
    };
    let deriv = |t: f32, c1: f32, c2: f32| {
        let u = 1.0 - t;
        3.0 * u * u * c1 + 6.0 * u * t * (c2 - c1) + 3.0 * t * t * (1.0 - c2)
    };
    let mut t = x;
    for _ in 0..8 {
        let slope = deriv(t, 0.25, 0.25);
        if slope.abs() < 1e-5 {
            break;
        }
        t = (t - (bez(t, 0.25, 0.25) - x) / slope).clamp(0.0, 1.0);
    }
    bez(t, 0.1, 1.0)
}

fn main() {
    let event_loop = EventLoop::<Command>::with_user_event().build().expect("event loop");
    let proxy = event_loop.create_proxy();
    std::thread::spawn(move || {
        let stdin = std::io::stdin();
        for line in stdin.lines() {
            let Ok(line) = line else { break };
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            match serde_json::from_str::<Command>(line) {
                Ok(command) => {
                    if proxy.send_event(command).is_err() {
                        break;
                    }
                }
                Err(err) => eprintln!("orion-output: {err}"),
            }
        }
        let _ = proxy.send_event(Command::Quit);
    });
    let mut app = App::new();
    if let Err(err) = event_loop.run_app(&mut app) {
        eprintln!("orion-output: {err}");
    }
}

impl ApplicationHandler<Command> for App {
    fn resumed(&mut self, _event_loop: &ActiveEventLoop) {}

    fn user_event(&mut self, event_loop: &ActiveEventLoop, event: Command) {
        match event {
            Command::Quit => event_loop.exit(),
            Command::Hide => {
                self.outputs.clear();
                self.gpu = None;
                self.base = None;
                self.overlay = None;
                event_loop.exit();
            }
            Command::Configure { displays } => self.configure(event_loop, displays),
            Command::Stage { base, overlay } => {
                self.base = base;
                self.overlay = overlay;
                self.rebuild();
            }
        }
    }

    fn window_event(&mut self, _event_loop: &ActiveEventLoop, id: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::RedrawRequested => self.render(id),
            WindowEvent::Resized(size) => self.resize(id, size),
            WindowEvent::CloseRequested => {}
            _ => {}
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
        if self.animating() {
            for output in self.outputs.values() {
                output.window.request_redraw();
            }
        }
    }
}

impl App {
    fn resize(&mut self, id: WindowId, size: PhysicalSize<u32>) {
        let Some(gpu) = self.gpu.as_ref() else { return };
        let Some(output) = self.outputs.get_mut(&id) else { return };
        output.config.width = size.width.max(1);
        output.config.height = size.height.max(1);
        output.surface.configure(&gpu.device, &output.config);
        output.base.key.clear();
        if let Some(layer) = output.overlay.as_mut() {
            layer.key.clear();
        }
        self.rebuild();
    }
}
