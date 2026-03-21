export async function loadIncludes(root = document) {
    const placeholders = [...root.querySelectorAll('[data-include]')];

    await Promise.all(
        placeholders.map(async (placeholder) => {
            const includePath = placeholder.getAttribute('data-include');
            if (!includePath) return;

            const response = await fetch(includePath, { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`Failed to load include: ${includePath}`);
            }

            const markup = await response.text();
            placeholder.insertAdjacentHTML('beforebegin', markup);
            placeholder.remove();
        })
    );
}

