import { checkWorkAssignment } from '../../Services/WorkAssignment/WorkAssignmentService';
import { getUserDetails, saveUserDetails, clearAll } from '../../utils/storage';
import { setIsLogin } from '../../Services/Login/LoginService';

// ─── Check Work Assignment & Navigate ────────────────────────────────────────
export const checkAndStartSurvey = async (navigate, showAlert, setLoading) => {
  setLoading(true);

  try {
    const user = await getUserDetails();

    if (!user?.userId) {
      showAlert('error', 'Session expired. Please login again.');
      setLoading(false);
      navigate('Login');
      return;
    }

    const resp = await checkWorkAssignment(user.userId);

    if (resp.status === 'success') {
      // Persist assignment data alongside user details
      await saveUserDetails({
        ...user,
        line: resp.data.line ?? null,
        ward: resp.data.ward ?? null,
      });
      setLoading(false);
      navigate('MapScreen');
    } else {
      showAlert('error', resp.message);
      setLoading(false);
    }
  } catch (err) {
    showAlert('error', 'Something went wrong. Please try again.');
    setLoading(false);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logoutSurveyor = async (navigate, showAlert) => {
  try {
    const user = await getUserDetails();
    if (user?.userId) {
      await setIsLogin(user.userId);
    }
    await clearAll();
    showAlert('success', 'Logged out successfully!');
    setTimeout(() => navigate('Login'), 1000);
  } catch (err) {
    showAlert('error', 'Logout failed. Please try again.');
  }
};
