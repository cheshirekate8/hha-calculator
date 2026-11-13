# hha-calculator pipeline image — the thin per-project layer (pipeline DESIGN.md §6).
#
# FROM the pipeline base (Node, git, Claude Code CLI, bd), plus EXACTLY the npm packages
# pipeline.config.json declares under "dependencies", which must also match package.json's
# dependencies + devDependencies at the same pinned versions once that file exists. All
# three lists must match: change one, change all, and rebuild. Task containers have no
# network, so nothing can be installed at run time.
#
# Packages resolve from /node_modules, above the /workspace clone: Node's, TypeScript's,
# Vite's and Vitest's resolvers walk parent directories, so imports from /workspace find
# them and nothing is written into the task's working tree. npm cannot install at / itself
# ("Tracker idealTree already exists"), so they live in /opt/deps and /node_modules links
# there. /node_modules/.bin is on PATH, so pipeline commands call `tsc`, `vite` and
# `vitest` directly, never through npx, which tries the registry when it cannot find a
# local bin.
#
# Build: docker build -t pipeline-hha-calculator:local .
FROM pipeline-base:local

USER root
WORKDIR /opt/deps
RUN echo '{"private":true}' > package.json \
    && npm install --no-save --no-package-lock --no-fund --no-audit \
      @types/node@22.20.5 \
      @types/react@19.3.0 \
      @types/react-dom@19.3.0 \
      @vitejs/plugin-react@6.1.2 \
      react@19.3.1 \
      react-dom@19.3.1 \
      typescript@6.0.3 \
      vite@8.3.5 \
      vitest@5.1.0 \
    && ln -s /opt/deps/node_modules /node_modules \
    && rm -rf /root/.npm
ENV PATH=/node_modules/.bin:$PATH

USER node
WORKDIR /workspace
