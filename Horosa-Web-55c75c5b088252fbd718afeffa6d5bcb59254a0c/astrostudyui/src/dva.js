import { handleError } from './utils/helper';


export function config() {
    return {
        onError(err) {
            console.log(err);
            handleError(err);
        },
    };

}
