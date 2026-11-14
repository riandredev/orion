/// Same mixing as projection-client.js `pixelHash`, including JS `Math.imul`.
#[allow(dead_code)]
pub fn pixel_hash(x: u32, y: u32, seed: u32) -> f32 {
    fn imul(a: u32, b: u32) -> u32 {
        (a as i32).wrapping_mul(b as i32) as u32
    }
    let mut h = imul(x + 1, 0x27d4_eb2d) ^ imul(y + 1, 0x1656_67b1) ^ imul(seed + 1, 0x2c1b_3c6d);
    h = imul(h ^ (h >> 15), 0x85eb_ca6b);
    h = imul(h ^ (h >> 13), 0xc2b2_ae35);
    ((h ^ (h >> 16)) as f32) / 4294967296.0
}

pub fn pixel_grid(width: u32, height: u32) -> (u32, u32) {
    let cell = (width.min(height) / 68).max(8);
    let cols = (width / cell).max(2);
    let rows = (height / cell).max(2);
    (cols, rows)
}

#[cfg(test)]
mod tests {
    use super::pixel_hash;

    #[test]
    fn matches_the_projection_page() {
        let a = pixel_hash(0, 0, 1);
        let b = pixel_hash(3, 5, 9);
        assert!((a - 0.5303555566351861).abs() < 0.00001);
        assert!((b - 0.8849138014484197).abs() < 0.00001);
    }
}
