/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.orion.presenter',
  productName: 'Orion',
  executableName: 'Orion',
  extraMetadata: {
    desktopName: 'orion.desktop'
  },
  directories: {
    output: 'dist/standard'
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
  extraResources: [
    { from: 'build/icon.png', to: 'icon.png' },
    { from: 'build/edition-standard.json', to: 'edition.json' },
    { from: 'bundles/catalog.json', to: 'content/bundles-catalog.json' },
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
    executableName: 'orion',
    synopsis: 'Orion church presentation',
    desktop: {
      entry: {
        StartupWMClass: 'orion',
        Icon: 'orion'
      }
    }
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: 'Orion',
    uninstallDisplayName: 'Orion',
    artifactName: 'Orion-${version}-windows-setup.${ext}'
  },
  appImage: {
    artifactName: 'Orion-${version}-linux.${ext}'
  }
}
