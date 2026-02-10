export const StatItem = (props: { label: string; value: number }) => (
    <div class="flex flex-col">
        <span class="text-xs text-neutral/60">{props.label}</span>
        <span class="font-semibold">{props.value}</span>
    </div>
);
