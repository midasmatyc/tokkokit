export default {
  server: {
    allowedHosts: true,
    watch: {
      ignored: [
        '**/*.pdf',
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.exe',
        '**/*.tmp',
        '**/.git/**',
      ],
    },
  },
};
