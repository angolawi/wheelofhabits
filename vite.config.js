import { defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  // Try to determine base path for GitHub Pages
  // GITHUB_REPOSITORY is automatically set by GitHub Actions (e.g., "username/repo-name")
  let base = '/';
  if (process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
    if (repoName) {
      base = `/${repoName}/`;
    }
  }

  return {
    base,
    // Add any other specific vite configuration here
  }
})
