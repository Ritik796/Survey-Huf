import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AlertProvider } from './src/Components/AlertToast/AlertToast';
import { CommonAlertProvider } from './src/Components/CommonAlert/CommonAlert';
import { LoaderProvider } from './src/Components/LoaderContext';
import { initFirebase } from './src/Firebase/firebaseConfig';

// Initialize Firebase once at app start
initFirebase();

// Screens
import SplashScreen      from './src/Screens/SplashScreen';
import LoginScreen       from './src/Screens/LoginScreen';
import StartSurveyScreen from './src/Screens/StartSurveyScreen';
import HomeScreen        from './src/Screens/HomeScreen';
import MapScreen         from './src/Screens/MapScreen';

const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <AlertProvider>
        <CommonAlertProvider>
        <LoaderProvider>
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Splash"
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name="Splash"       component={SplashScreen} />
              <Stack.Screen name="Login"        component={LoginScreen} />
              <Stack.Screen name="StartSurvey"  component={StartSurveyScreen} />
              <Stack.Screen name="MapScreen"    component={MapScreen} />
              <Stack.Screen name="Home"         component={HomeScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </LoaderProvider>
        </CommonAlertProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}

export default App;
