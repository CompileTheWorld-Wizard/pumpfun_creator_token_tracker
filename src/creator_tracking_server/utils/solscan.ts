
export async function getCreatedTokens(walletAddress: string) {
    const apiKey = process.env.SOLSCAN_API_KEY;

    const requestOptions = {
        method: "get",
        headers: { "token": apiKey || "" }
    };

    const url = `https://pro-api.solscan.io/v2.0/token/defi/activities?address=${walletAddress}&activity_type[]=ACTIVITY_SPL_INIT_MINT&page=1&page_size=100&sort_by=block_time&sort_order=desc`;

    try {
        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            throw new Error(`Solscan API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Error fetching created tokens from Solscan:", err);
        throw err;
    }
}
