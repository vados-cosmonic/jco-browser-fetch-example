export async function ping(s) {
  const url = new URL("https://jsonplaceholder.typicode.com/posts/1");
  const r = await (await fetch(url)).json();
  return `hello:${s}, r: ${JSON.stringify(r)}`;
}
