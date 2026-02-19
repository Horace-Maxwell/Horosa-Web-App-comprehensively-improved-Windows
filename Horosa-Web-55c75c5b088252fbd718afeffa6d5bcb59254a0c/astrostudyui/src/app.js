import { handleError } from './utils/helper';


export const dva = {
    config: {
        onError(err) {
            console.log(err);
            handleError(err);
        },
    },
}
