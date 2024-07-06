# Vite Plugin Svelte Xblock

A Vite plugin that enables the use of `.svelte.xblock` files in your Svelte and SvelteKit projects. This plugin allows you to create reusable code blocks with shared context, enhancing code organization and maintainability.

## Why Svelte Xblock?

In modern web development, we often distinguish between components and code blocks. Components are designed to be reusable across different contexts, accepting various parameters and props. However, when dealing with complex business logic, components can quickly become large and unwieldy.

The traditional approach to managing this complexity is to break down large components into smaller sub-components. While this can improve code organization, it often leads to its own set of challenges:

1. These sub-components are frequently only used within the context of the parent component.
2. Managing data flow between the parent and child components can become complex, requiring careful prop drilling or state management.
3. The cognitive overhead of navigating between multiple files can make it harder to understand the overall component logic.

Svelte Xblock offers a solution to these challenges by introducing the concept of code blocks:

- **Shared Context**: Xblocks share the same context as their parent component, eliminating the need for complex prop passing or state management.
- **Single Use Guarantee**: Each Xblock can only be used once, ensuring a unique context and preventing unintended reuse.
- **Improved Readability**: By allowing developers to split large components into logical blocks in separate files, Xblock makes the codebase more readable and maintainable.
- **Simplified Maintenance**: Developers can work on individual Xblocks without losing the context of the parent component, making it easier to manage and update complex components.

In essence, Svelte Xblock allows you to organize your code more cleanly without the overhead of creating full-fledged sub-components. It's particularly useful for large, complex components that are specific to your business logic and not intended for reuse across your application.

## Features

- Introduces a new `.svelte.xblock` file type for Svelte code blocks
- Merges `.svelte.xblock` files into their parent Svelte components at build time
- Ensures that each `.svelte.xblock` file is only used once in your project
- Combines scripts, styles, and HTML templates from `.svelte.xblock` files with their parent components
- Allows `.svelte.xblock` files to directly access variables and functions from their parent Svelte component
- Provides helpful error messages for naming conflicts and multiple usage attempts
- Supports both Svelte and SvelteKit projects

## Installation

```bash
npm install --save-dev
```

## Usage

### For Svelte with Vite

1. Add the plugin to your Vite configuration:

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import svelteXBlockPlugin from 'vite-plugin-svelte-xblock'

export default defineConfig({
  plugins: [
    svelteXBlockPlugin(),
    svelte()
  ]
})
```

### For SvelteKit

1. Add the plugin to your SvelteKit configuration:

```javascript
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import svelteXBlockPlugin from 'vite-plugin-svelte-xblock'

export default defineConfig({
  plugins: [
    svelteXBlockPlugin(),
    sveltekit()
  ]
});
```

**Important Note**: Make sure to place `svelteXBlockPlugin()` before the Svelte or SvelteKit plugin in the plugins array. This ensures that `.svelte.xblock` files are processed before Svelte compilation occurs.

2. Create a `.svelte.xblock` file that uses variables from its parent component:

```html
<!-- UserGreeting.svelte.xblock -->
<script>
  // No need to declare or import 'username', it's accessed from the parent context
  export let greetingText = 'Hello'
</script>

<div class="greeting">
  {greetingText}, {username}!
</div>

<style>
  .greeting {
    font-size: 1.2em;
    color: #333;
  }
</style>
```

3. Use the `.svelte.xblock` file in your Svelte component:

```html
<!-- +page.svelte -->
<script>
  import UserGreeting from './UserGreeting.svelte.xblock'
  
  let username = 'Alice'
  let timeOfDay = 'morning'
</script>

<main>
  <h1>Welcome to my SvelteKit app!</h1>
  <UserGreeting greetingText="Good {timeOfDay}" />
  
  <input bind:value={username} placeholder="Enter your name">
</main>
```

In this example, `UserGreeting.svelte.xblock` can directly access the `username` variable from its parent component. It also receives the `greetingText` prop, which uses the `timeOfDay` variable from the parent.

## How It Works

The plugin intercepts imports of `.svelte.xblock` files and merges their content with the parent Svelte component. This process includes:

1. Merging the `<script>` tags, allowing the xblock to access variables and functions from the parent component
2. Inserting the HTML template at the point of usage
3. Merging the `<style>` tags

The plugin ensures that each `.svelte.xblock` file is only used once in your project to prevent potential conflicts. It also allows `.svelte.xblock` files to seamlessly access the context of their parent components, enabling powerful composition patterns without the overhead of creating separate components.

## SvelteKit Specific Notes

- The plugin works seamlessly with SvelteKit's file-based routing system.
- You can use `.svelte.xblock` files in any of your SvelteKit routes or components.
- The plugin respects SvelteKit's server-side rendering (SSR) capabilities.
- Shared context works in both client-side and server-side rendered components.

## Limitations

- Each `.svelte.xblock` file can only be used once in your project
- The plugin does not currently support nested `.svelte.xblock` files (i.e., a `.svelte.xblock` file importing another `.svelte.xblock` file)
- Care should be taken to avoid naming conflicts between variables in the parent component and the xblock

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
