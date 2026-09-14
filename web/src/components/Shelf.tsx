import { ReactNode } from "react";

interface ShelfProps {
  title: string;
  children: ReactNode;
}

export default function Shelf({ title, children }: ShelfProps) {
  return (
    <section className="shelf">
      <h2 className="shelf-title">
        {title}
        <span className="shelf-chevron">›</span>
      </h2>
      <div className="shelf-row">{children}</div>
    </section>
  );
}
