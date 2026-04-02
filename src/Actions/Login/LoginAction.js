import { getSurveyorLogin, setIsLogin } from '../../Services/Login/LoginService';
import { saveUserDetails, clearAll, getUserDetails } from '../../utils/storage';

// ─── Login ────────────────────────────────────────────────────────────────────
export const getLoggedInSurveyor = async (navigate, userId, showAlert, setLoading) => {
  setLoading(true);

  const resp = await getSurveyorLogin(userId);

  if (resp.status === 'success' && resp.data) {
    const data = resp.data;
    const resolvedName = data?.name ?? data?.Name ?? data?.surveyorName ?? '';

    await saveUserDetails({
      name:          resolvedName,
      userPin:       data.pin,
      mobileNo:      data.mobile,
      identityImage: data['identity-image'],
      isLogin:       data.isLogin,
      userId:        String(data.userId),
    });

    showAlert('success', 'Logged in successfully!');
    setTimeout(() => {
      setLoading(false);
      navigate('StartSurvey');
    }, 1500);
  } else {
    showAlert('error', resp.message ?? 'Login failed.');
    setLoading(false);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logoutSurveyor = async (navigate, showAlert) => {
  const user = await getUserDetails();

  if (user?.userId) {
    await setIsLogin(user.userId);
  }

  await clearAll();
  showAlert('success', 'Logged out successfully!');
  setTimeout(() => navigate('Login'), 1000);
};
