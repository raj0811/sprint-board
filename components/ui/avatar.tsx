type AvatarProps = { initials: string; color?: string; size?: "sm" | "md" };

const colors: Record<string, string> = {
  lavender: "bg-[#ded5ff] text-[#5a47a0] dark:bg-[#7d62ee]/25 dark:text-[#c3b6ff]",
  mint: "bg-[#cceee4] text-[#2f7a64] dark:bg-[#3fb875]/20 dark:text-[#7fdcb0]",
  peach: "bg-[#ffe0d1] text-[#a35a3d] dark:bg-[#f19a6f]/20 dark:text-[#f7b896]",
  sky: "bg-[#d4e9ff] text-[#3f6d9e] dark:bg-[#5fb6e0]/20 dark:text-[#9fd2f0]",
  plum: "bg-[#ead9ef] text-[#7d5285] dark:bg-[#c77fd6]/20 dark:text-[#e2b4ec]",
  neutral: "bg-[#efedf3] text-[#6f6b7a] dark:bg-white/10 dark:text-[#c2c0cf]",
};

export function Avatar({ initials, color = "neutral", size = "md" }: AvatarProps) {
  return <span className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs"} ${colors[color] ?? colors.neutral}`}>{initials}</span>;
}
