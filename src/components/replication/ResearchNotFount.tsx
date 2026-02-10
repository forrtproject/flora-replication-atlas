export const ResearchNotFound = ({ doi }: { doi?: string }) => {
    return (
        <div class="p-4 rounded-md flex justify-center">
            <div class="card max-w-full bg-base-100">
                <div class="card-body">
                    <h2 class="card-title">Oops! Not Found</h2>
                    <div role="alert" class="alert alert-error alert-soft flex flex-col flex-1">
                        <span>Please check the DOI and try again.</span>
                    </div>
                    <div class="divider">OR</div>
                    <div role="alert" class="alert alert-info alert-soft flex flex-col flex-1">
                        <span>
                            <a href={`https://docs.google.com/forms/d/e/1FAIpQLSeMCwdtP0TPgL55stniuyyTxnNwyC34mO4VUuLcQwYrLI89sQ/viewform?usp=pp_url&entry.1234567890=${encodeURIComponent(doi || '')}`} target="_blank">
                                Click here to contribute by submitting a new replication entry through this form.
                            </a>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}