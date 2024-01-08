import { Pre, Tabs } from "nextra/components";

export function Snippets({ children }) {
  // console.log(props);
  // return "Hello world";

  // console.log(children.map((child) => child.props.children));
  const { children: ignore, ...props } = children[0].props;

  return (
    <Pre {...props} className="pt-0">
      <div className="flex gap-1 px-2 py-2 text-xs">
        <div className="py-1 px-3 border rounded-md text-slate-300">Ents</div>
        <div className="py-1 px-3 border rounded-md text-slate-300">
          Built-in Convex
        </div>
      </div>
      {children.map((child) => child.props.children)[0]}
    </Pre>
  );
}
