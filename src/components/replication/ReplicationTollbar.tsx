import { EyeOpenIcon } from "../icons/eye-open";

export const ReplicationToolbar = (props: { title?: string | null, doi?: string | null }) => {
    return (
        <div class="navbar bg-neutral shadow-sm max-w-full rounded-t-sm">
            {
                props.doi ? (
                    <div class="navbar-start">
                        <a class="btn btn-sm" href={`https://doi.org/${props.doi}`} target="__blank">
                            <span class="mr-2"><EyeOpenIcon /></span>
                            <span>View Research</span>
                        </a>
                    </div>
                ) : null
            }
        </div>
    );
}