export async function runConsensus(proposals: string[]) {
    if (proposals.length === 0) return { winner: "Error: No proposals generated" };
    if (proposals.length === 1) return { winner: proposals[0] };

    // A simple fallback for now, as exact consensus pipeline instructions were left open
    // Just return the first one as winner to unblock the build.
    return { winner: proposals[0] };
}
