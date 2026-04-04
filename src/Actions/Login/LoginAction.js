import { getSurveyorLogin, setIsLogin } from '../../Services/Login/LoginService';
import { checkWorkAssignment } from '../../Services/WorkAssignment/WorkAssignmentService';
import { saveUserDetails, clearAll, getUserDetails } from '../../utils/storage';

// ─── Login ────────────────────────────────────────────────────────────────────
export const getLoggedInSurveyor = async (navigate, userId, showAlert, setLoading) => {
  setLoading(true);

  try {
    const resp = await getSurveyorLogin(userId);

    if (resp.status === 'success' && resp.data) {
      const data = resp.data;
      const resolvedName = data?.name ?? data?.Name ?? data?.surveyorName ?? '';

      const baseUser = {
        name: resolvedName,
        userPin: data.pin,
        mobileNo: data.mobile,
        identityImage: data['identity-image'],
        isLogin: data.isLogin,
        userId: String(data.userId),
      };

      // Check assignment at login as well; StartSurvey will re-check before entering map.
      const assignmentResp = await checkWorkAssignment(baseUser.userId);
      if (assignmentResp?.status !== 'success') {
        await setIsLogin(baseUser.userId);
        showAlert('error', assignmentResp?.message || 'No work assignment found. Login blocked.');
        setLoading(false);
        return;
      }

      const userToSave = {
        ...baseUser,
        line: assignmentResp?.data?.line ?? null,
        ward: assignmentResp?.data?.ward ?? null,
      };

      await saveUserDetails(userToSave);

      showAlert('success', 'Logged in successfully!');

      setTimeout(() => {
        setLoading(false);
        navigate('StartSurvey');
      }, 1500);
      return;
    }

    showAlert('error', resp.message ?? 'Login failed.');
    setLoading(false);
  } catch (error) {
    showAlert('error', error?.message || 'Login failed.');
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
