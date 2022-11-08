import { commerce } from 'whitelabel-site';
const { useAuth } = commerce;
import { useRouter } from 'next/router';
// eslint-disable-next-line react/display-name
const withAuth = (WrappedComponent) => (props) => {
  if (typeof window !== 'undefined') {
    const Router = useRouter();
    const { isAuthenticated, loading } = useAuth();
    if (!loading && !isAuthenticated) {
      Router.replace('/login');
      return <></>;
    }
    return <WrappedComponent {...props} />;
  }
  // If we are on server, return null
  return <></>;
};

export default withAuth;
