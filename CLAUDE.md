@AGENTS.md

# 发版规范（打 tag 前必须执行）

每次打 tag 发布新版本时，**必须先完成以下三步**，再执行 `git tag` 和 `git push`：

1. **更新 `package.json` 的 `version` 字段**，与 tag 号一致（如 tag `v0.3.9` → version `"0.3.9"`）
2. **同步更新 `package-lock.json` 第三行的 `version` 字段**，与 package.json 保持一致
3. **在 `CHANGELOG.md` 顶部追加本次版本的更新说明**，格式：
   ```
   ## vX.Y.Z (YYYY-MM-DD)
   - 说明1
   - 说明2
   ```

然后将这三个文件一起提交：

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

> **原因**：CI（GitHub Actions）使用 `package.json` 的 `version` 字段命名 release 和安装包文件名。
> 若版本号未更新，新 release 会覆盖旧 release，用户端 `latest.yml` 检测不到新版本，无法触发自动更新。
