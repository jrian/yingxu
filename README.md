# 映序 FRAME

浏览器中的视频提示词工作台：组织双图参考、导演与影片风格、简报、提示词和人工检查记录。

## 使用

访问 GitHub Pages 网站，或在仓库目录运行 `python3 -m http.server 8000`，然后打开 `http://localhost:8000/`。无需 npm 或构建依赖，适用于 Pages 项目子路径。

项目、上传参考和手动登记保存在当前浏览器的 localStorage，清除浏览器数据会丢失；请使用界面的导出制作包和导出资料清单备份。没有云端账号同步。不要把敏感内容当作云端备份。

尚未连接媒体生成、智能体调度、积分或付费接口。输入检查、方案审查和实际视频验收分别记录；示例项目的历史状态不代表新项目已通过。

## 来源与许可

导演方法文字来自 [DirectorSKILL](https://github.com/wuwangzhang1216/DirectorSKILL)，影片风格文字来自 [艺术审美风格库](https://github.com/YanKaFei/art-aesthetic-vault)。对应 MIT 许可保存在 `data/licenses/`，数据文件保留具体来源和版本。

影视封面与剧照是缓存的第三方参考图片，主要来源 Film-Grab，版权属于各权利人；数据保留来源链接及权利说明。这些图片不是本站原创，不能根据文字库的 MIT 许可推定图片获得转载或再利用许可。示例参考图不自动授予第三方使用权。

Pinterest 内容为 33 个公开分组的历史目录及少量公开 Pin 链接，没有账号凭据、私密分组或实时同步；公开性和数量可能随来源变化。点击官方预览后才加载 Pinterest 脚本，点击预告后才加载 YouTube 播放器。默认入口不加载 Figma 捕获脚本。

## 发布

推送到 `main` 或手动运行 Pages 工作流。工作流只打包入口、运行脚本、样式、data、assets 和 `.nojekyll`；不会把 Git 历史、工作流或 README 放进 Pages 站点。仓库本身仍为公开源码。
