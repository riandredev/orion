const panorama = process.env.ORION_EDITION === 'panorama'

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: panorama ? 'com.orion.presenter.panorama' : 'com.orion.presenter',
  productName: 'Orion',
  executableName: panorama ? 'OrionPanorama' : 'Orion',
  extraMetadata: {
    desktopName: panorama ? 'orion-panorama.desktop' : 'orion.desktop'
  },
  directories: {
    output: panorama ? 'dist/panorama' : 'dist/standard'
  },
  files: [
    '**/*',
    '!src',
    '!src/**',
    '!scripts',
    '!scripts/**',
    '!dist',
    '!dist/**',
    '!media',
    '!media/**',
    '!order-images',
    '!order-images/**',
    '!bibles',
    '!bibles/**',
    '!hymnals',
    '!hymnals/**',
    '!images',
    '!images/**',
    '!build/content-standard',
    '!build/content-standard/**',
    '!**/*.tsbuildinfo',
    '!**/*.md'
  ],
  extraResources: panorama
    ? [
        { from: 'build/icon.png', to: 'icon.png' },
        { from: 'build/edition-panorama.json', to: 'edition.json' },
        { from: 'order-images', to: 'content/order-images' },
        { from: 'hymnals/adventist-1-afrikaans', to: 'content/hymnals/adventist-1-afrikaans' },
        { from: 'hymnals/adventist-2-english-new', to: 'content/hymnals/adventist-2-english-new' },
        { from: 'bibles/eng-kjv', to: 'content/bibles/eng-kjv' },
        { from: 'bibles/bss-afri', to: 'content/bibles/bss-afri' },
        { from: 'images/bible-image.jpg', to: 'content/images/bible-image.jpg' },
        { from: 'images/bible-image.png', to: 'content/images/bible-image.png' },
        { from: 'images/hymn-image.jpg', to: 'content/images/hymn-image.jpg' }
      ]
    : [
        { from: 'build/icon.png', to: 'icon.png' },
        { from: 'build/edition-standard.json', to: 'edition.json' },
        { from: 'build/content-standard/hymnals', to: 'content/hymnals' },
        { from: 'bibles/eng-kjv', to: 'content/bibles/eng-kjv' }
      ],
  asarUnpack: ['**/*.node', '**/7zip-bin/**'],
  npmRebuild: false,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.png'
  },
  linux: {
    syncDesktopName: true,
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Office',
    icon: 'build/icons',
    executableName: panorama ? 'orion-panorama' : 'orion',
    synopsis: 'Orion church presentation',
    desktop: {
      entry: {
        StartupWMClass: panorama ? 'orion-panorama' : 'orion',
        Icon: panorama ? 'orion-panorama' : 'orion'
      }
    }
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: 'Orion',
    uninstallDisplayName: 'Orion',
    ...(panorama ? { include: 'build/nsis-panorama-dir.nsh' } : {}),
    artifactName: panorama
      ? 'Orion-Panorama-${version}-windows-setup.${ext}'
      : 'Orion-${version}-windows-setup.${ext}'
  },
  appImage: {
    artifactName: panorama
      ? 'Orion-Panorama-${version}-linux.${ext}'
      : 'Orion-${version}-linux.${ext}'
  }
}
