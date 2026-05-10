import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * MathText — renders text with inline LaTeX support.
 *
 * Syntax:
 *   $$...$$  → block math (display mode)
 *   $...$    → inline math
 *
 * Example:
 *   "Tính $x^2 + y^2$ khi $x = 3$"
 *   "Công thức: $$\\frac{a}{b}$$"
 */
export default function MathText({ children, sx, variant, component: Component = 'span', ...rest }) {
  const html = useMemo(() => {
    if (!children || typeof children !== 'string') return children || '';
    return renderMath(children);
  }, [children]);

  if (!children || typeof children !== 'string') {
    return <Component {...rest}>{children}</Component>;
  }

  return (
    <Component
      dangerouslySetInnerHTML={{ __html: html }}
      style={sx}
      {...rest}
    />
  );
}

function renderMath(text) {
  // First pass: replace $$...$$ (block math)
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span style="color:red">[Math Error]</span>`;
    }
  });

  // Second pass: replace $...$ (inline math), but not escaped \$
  result = result.replace(/(?<![\\$])\$([^$\n]+?)\$/g, (_match, tex) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<span style="color:red">[Math Error]</span>`;
    }
  });

  // Convert newlines to <br> for multi-line text, but only if it's not already HTML from Rich Text Editor
  if (!/<[a-z][\s\S]*>/i.test(result)) {
    result = result.replace(/\n/g, '<br/>');
  }

  // Third pass: unescape \$ to $
  result = result.replace(/\\\$/g, '$');

  return result;
}
