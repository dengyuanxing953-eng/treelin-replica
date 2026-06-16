/* ============================================================
 *  《希望》作品配置  —  改这一个文件就能替换 / 增删全部作品
 * ------------------------------------------------------------
 *  字段说明（四轮通用）：
 *    src     媒体路径，后缀自动识别：
 *              jpg/png/webp/gif → 图片    mp4/webm → 视频(自动播放·静音·循环)
 *    name    标题        caption 副标题/说明        tag 角标(如 小程序/游戏)
 *    url     "访问 →" 链接（留空则不显示按钮）
 *    span    仅视觉轮 Bento 用：big=2x2  wide=2x1  tall=1x2  省略=1x1
 *
 *  · src 留空 → 自动显示「优雅占位图」，空着也成片
 *  · 想加作品：往数组里复制一段对象；想删：删掉那段即可
 *  · 所有视频已转码压缩，开箱即放
 * ============================================================ */

/* 媒体基址：阿里云 OSS 杭州直链（大陆访问快一个量级）。
   仓库里同路径文件仍在（Vercel 也有一份）——想回退只需把 B 改成 ""。
   素材更新后同步：~/bin/ossutil cp -r works oss://treelin-hope/works -f */
var B = "assets/oss/";
window.MEDIA_BASE = B;

window.WORKS = {

  /* 【作品轮 1】视觉创造力 —— 海报 · 写真 · 品牌设计  (瀑布流)
     ratio = "宽/高"：自由尺寸瓦片在媒体数据未到时用它锁住占位高度（慢网防画框塌缩） */
  visual: [
    { src: B + "works/visual/01.mp4", name: "海报展览",       caption: "几十张主视觉连放", ratio: "480/270" },
    { src: B + "works/visual/02.mp4", name: "海报展览\u00A0·\u00A0动态", caption: "商业海报交付实录", ratio: "1280/750" },
    { src: B + "works/visual/03.mp4", name: "影像档案馆",     caption: "331\u00A0张写真海报，旋成一座展馆", ratio: "1280/716", span: "full" },
  ],

  /* 【作品轮 2】网站开发 —— 浏览器框架展示，左右交替
     （原 GIF 已全部转码为 MP4：同画质体积 -80%，大陆慢网友好；播放行为不变=自动·静音·循环） */
  websites: [
    { src: B + "works/websites/08.mp4", name: "顶尖个人介绍网站", highlight: "从零搭建\u00A0·\u00A0沉浸式个人站" },
    { src: B + "works/websites/04.mp4", name: "特效网站",         highlight: "WebGL 特效\u00A0·\u00A0沉浸交互" },
    { src: B + "works/websites/01.mp4", name: "互动式小说",       highlight: "分支叙事\u00A0·\u00A0滚动驱动" },
    { src: B + "works/websites/07.mp4", name: "顶级汽车产品网站", highlight: "产品展示\u00A0·\u00A0电影级运镜" },
    { src: B + "works/websites/10.mp4", name: "语言的力量",     highlight: "像素互动\u00A0·\u00A0一场语言的思辨" },
    { src: B + "works/websites/11.mp4", name: "成员感悟网站",     highlight: "粒子肖像\u00A0·\u00A0沉浸叙事长卷" },
  ],

  /* 【作品轮 3】小程序 · 软件 · 产品  (手机框，居中)
     —— 3 个真实产品：手机Web应用 + 横屏网页游戏 + 原生微信小程序；
        wide:true → 渲染成 16:9 横屏「游戏屏」卡片(承载横屏录屏，不裁画面) */
  products: [
    { src: B + "works/products/01.mp4",   name: "手机端审美网站", tag: "Web 应用", caption: "TasteLens\u00A0·\u00A0上传人像，30\u00A0秒出审美对照报告" },
    { src: B + "works/products/game.mp4", name: "王权\u00A0·\u00A0抉择游戏", tag: "游戏",     caption: "网页端可玩\u00A0·\u00A0每一次抉择都有代价", wide: true },
    { src: B + "works/products/02.mp4",   name: "林深有径",       tag: "小程序",   caption: "微信原生小程序\u00A0·\u00A0沉浸式长文阅读" },
  ],

  /* 【作品轮 4】AI 自动化 · 企业部署  (宽卡片：标题 + 描述 + 录屏) */
  automation: [
    { src: B + "works/automation/01.mp4", title: "一键总结微信消息",   description: "每天自动把上百条群聊提炼成结构化日报，老板打开就懂" },
    { src: B + "works/automation/02.mp4", title: "一键多平台发布内容", description: "一次成稿，自动分发到<span class='nb'>公众号 · 小红书 · 抖音</span>，省下一整个运营" },
    { src: B + "works/automation/03.mp4", title: "自动爬取群聊的项目", description: "自动抓取群里散落的项目链接，聚合成<span class='nb'>可浏览 · 可下载</span>的作品集" },
    { src: B + "works/automation/04.mp4", title: "AI 短视频一键生成",   description: "一句创意\u00A0→\u00A0分镜、画面、配乐，自动产出电影感<span class='nb'>短视频</span>，发布即用" },
    { src: B + "works/automation/05.mp4", title: "文案一键成片",       description: "一段文字稿，自动配上画面、字幕、配音，秒变可发布的口播视频" },
  ],
};
