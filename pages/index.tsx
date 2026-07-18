// Locked manifest (epic zudolab/zudo-doc#2651, Decision 4 on #2653): the home
// route is a 1-line re-export of the package-owned STATIC index route.
// Verified by the #2652 spike (Q2) to build, dev-render, and hydrate — a
// dynamic route (see pages/docs/[[...slug]].tsx) cannot use this form because
// `paths()` static-AST-extraction requires source, not compiled `dist/` JS.
export { default } from "@takazudo/zudo-doc/routes/index";
