const svgNamespace = "http://www.w3.org/2000/svg";

function svgElement<Tag extends keyof SVGElementTagNameMap>(
  tag: Tag,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[Tag] {
  const element = document.createElementNS(svgNamespace, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function closedCurve(points: readonly (readonly [number, number])[]): string {
  const segments = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  return `${segments.join(" ")} Z`;
}

function petalRing(cx: number, cy: number, radius: number, petals: number, depth: number, twist: number): string {
  const steps = 180;
  const points: [number, number][] = [];
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const r = radius * (1 + depth * Math.sin(petals * angle + twist));
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return closedCurve(points);
}

function blob(cx: number, cy: number, radius: number, seed: number): string {
  const steps = 120;
  const points: [number, number][] = [];
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const wobble = 0.14 * Math.sin(3 * angle + seed) + 0.08 * Math.sin(5 * angle + seed * 2);
    const r = radius * (1 + wobble);
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return closedCurve(points);
}

export function mountBackdrop(): void {
  const svg = svgElement("svg", {
    class: "backdrop",
    viewBox: "0 0 1000 1000",
    preserveAspectRatio: "xMidYMid slice",
    "aria-hidden": "true",
  });

  svg.append(
    svgElement("path", { d: blob(140, 180, 210, 1.3), fill: "var(--pale)", opacity: 0.07 }),
    svgElement("path", { d: blob(880, 760, 260, 4.1), fill: "var(--pale)", opacity: 0.06 }),
    svgElement("rect", { x: -40, y: 640, width: 220, height: 400, fill: "var(--coral)", opacity: 0.1 }),
    svgElement("rect", { x: 820, y: -40, width: 90, height: 360, fill: "var(--slate)", opacity: 0.12 }),
    svgElement("rect", { x: 920, y: -40, width: 120, height: 220, fill: "var(--coral)", opacity: 0.09 }),
  );

  const rings = [
    { radius: 230, shade: "var(--slate-deep)" },
    { radius: 190, shade: "var(--slate)" },
    { radius: 150, shade: "var(--slate-deep)" },
    { radius: 112, shade: "var(--slate)" },
    { radius: 76, shade: "var(--slate-deep)" },
    { radius: 44, shade: "var(--slate)" },
  ];
  const flower = svgElement("g", { opacity: 0.16 });
  rings.forEach((ring, index) => {
    flower.append(svgElement("path", { d: petalRing(760, 300, ring.radius, 8, 0.12, index * 0.35), fill: ring.shade }));
  });
  flower.append(svgElement("circle", { cx: 760, cy: 300, r: 16, fill: "var(--coral)" }));
  svg.append(flower);

  document.body.prepend(svg);
}
