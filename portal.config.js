window.QQFARM_PORTAL_CONFIG = {
  refreshIntervalMs: 30000,
  visibilityCacheVersion: 13,
  // 静态托管（GitHub Pages）：不走后端 API，直接用下面的 nodes 配置
  nodesApiUrl: false,
  nodes: [
    {
      name: '线路一 · 主力',
      url: 'http://36.133.116.183:3027',
      online: true,
      usersCount: 131,
      maxUsers: 150,
      canAddAccount: true,
      bestEnabled: true,
    },
    {
      name: '线路二 · 备用',
      url: 'http://36.137.25.32:3007',
      online: true,
      usersCount: 23,
      maxUsers: 300,
      canAddAccount: true,
      bestEnabled: false,
    },
  ],
  // 首页验证方式：captcha 可选，identifier 可选 username/card/both。
  access: {
    captchaEnabled: false,
    identifierMode: 'both',
    directRedirect: true,
  },
}
