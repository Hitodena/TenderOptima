// Lets plain Node resolve the `#shared/...` alias Nuxt provides, so the pure
// helpers in `shared/utils` can be tested without building the app.
export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith('#shared/')) {
		const target = new URL(`../shared/${specifier.slice('#shared/'.length)}.ts`, import.meta.url)
		return nextResolve(target.href, context)
	}
	return nextResolve(specifier, context)
}
