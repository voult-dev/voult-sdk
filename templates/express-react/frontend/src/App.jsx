import { useSession } from '@voult/react';
import Account from './pages/Account.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Home from './pages/Home.jsx';
import Mfa from './pages/Mfa.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';

// One page per path. Plain links and full page loads keep it simple, and a full load is the
// right move after signing in or out anyway. Swap in a router library whenever you like.
const PAGES = {
  '/': Home,
  '/login': SignIn,
  '/signup': SignUp,
  '/mfa': Mfa,
  '/account': Account,
  '/forgot-password': ForgotPassword,
  '/reset-password': ResetPassword,
  '/verify-email': VerifyEmail,
};

export default function App() {
  const { status, user } = useSession();
  const Page = PAGES[location.pathname] ?? Home;
  return (
    <>
      <nav>
        <a href="/">Home</a>
        <a href="/account">Account</a>
        <span className="who">{status === 'authenticated' ? user.email : status === 'loading' ? '' : <a href="/login">Sign in</a>}</span>
      </nav>
      <main><Page /></main>
    </>
  );
}
