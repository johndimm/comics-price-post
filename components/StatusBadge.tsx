interface StatusBadgeProps {
    status: string; // "NFS", "For Sale", "Sold", etc.
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    let cls = "status-nfs";
    if (status?.toLowerCase().includes("sale")) cls = "status-sale";
    else if (status?.toLowerCase().includes("sold")) cls = "status-sold";

    const label = status || "NFS";

    return <span className={`status-badge ${cls}`}>{label}</span>;
}
