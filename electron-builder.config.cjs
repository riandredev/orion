const panorama = process.env.ORION_EDITION === 'panorama'

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: panorama ? 'com.orion.presenter.panorama' : 'com.orion.presenter',
  productName: panorama ? 'Orion Panorama' : 'Orion',
  executableName: panorama ? 'OrionPanorama' : 'Orion',
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
        { from: 'build/edition-panorama.json', to: 'edition.json' },
        { from: 'order-images', to: 'content/order-images' },
        { from: 'hymnals/adventist-1-afrikaans', to: 'content/hymnals/adventist-1-afrikaans' },
        { from: 'hymnals/adventist-2-english-new', to: 'content/hymnals/adventist-2-english-new' },
        { from: 'bibles/eng-kjv', to: 'content/bibles/eng-kjv' },
        { from: 'bibles/bss-afri', to: 'content/bibles/bss-afri' }
      ]
    : [
        { from: 'build/edition-standard.json', to: 'edition.json' },
        { from: 'build/content-standard/hymnals', to: 'content/hymnals' }
      ],
  asarUnpack: ['**/*.node', '**/7zip-bin/**'],
  npmRebuild: false,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'images/icon.png'
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Office',
    icon: 'images/icon.png',
    synopsis: panorama ? 'Orion Panorama church presentation' : 'Orion church presentation'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: panorama ? 'Orion Panorama' : 'Orion',
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
