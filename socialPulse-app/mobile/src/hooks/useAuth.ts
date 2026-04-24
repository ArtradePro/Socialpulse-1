import { useEffect, useState } from 'react';
import { authStore } from '../store/authStore';

export const useAuth = () => {
    const [state, setState] = useState(authStore.getState());

    useEffect(() => {
        return authStore.subscribe(() => setState(authStore.getState()));
    }, []);

    return state;
};
