/* Markdown guides imported as raw strings via next.config (turbopack rules +
 * webpack asset/source); rendered by react-markdown on the /agent/* pages. */
declare module "*.md" {
  const content: string;
  export default content;
}
