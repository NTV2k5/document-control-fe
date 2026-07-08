type TrendingHashtagsProps = {
  tags: string[];
};

export function TrendingHashtags({ tags }: TrendingHashtagsProps) {
  return (
    <div className="sticky top-20 z-30 -mt-8 mb-6 flex items-center gap-3 bg-[#F4F7FE] py-4 shadow-sm md:-mt-8 md:px-0">
      <span className="mr-2 hidden text-sm font-semibold tracking-wider text-muted-foreground uppercase sm:inline">
        TRENDING
      </span>
      <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto md:flex-wrap md:gap-3">
        {tags.map((tag, i) => {
          const isBlue = i % 2 !== 0; // Alternate colors
          return (
            <button
              key={i}
              className={`shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold shadow-sm transition-all hover:shadow-md md:px-5 md:py-2 md:text-sm ${
                isBlue ? 'text-blue-700' : 'text-slate-800'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
