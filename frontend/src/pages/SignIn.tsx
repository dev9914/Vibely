import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useLoginMutation } from '../services/userApi'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '../lib/validations'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/authSlice'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { AuthLayout, SocialLoginButton } from '../components/auth'
import { storeAccessTokenFromAuthResponse } from '../lib/authToken'

/**
 * SignIn Page
 * Premium split-screen layout with phone mockup hero
 */
const SignIn = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const [login, { isLoading }] = useLoginMutation()
  const [showPassword, setShowPassword] = useState(false)

  // Get redirect path from location state (if coming from protected route)
  const from = location.state?.from?.pathname || '/'

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const handleGoogleLogin = () => {
    toast('Coming soon', {
      description: 'Google login will be available shortly',
    })
    // TODO: Implement Google OAuth
  }

  const handleGithubLogin = () => {
    toast('Coming soon', {
      description: 'GitHub login will be available shortly',
    })
    // TODO: Implement GitHub OAuth
  }

  const onSubmit = async (data: { email: string; password: string }) => {
    try {
      const result = await login(data).unwrap()
      
      if (result?.user) {
        // ⚡ SYNC token save BEFORE navigate — eliminates race where
        //    onQueryStarted (async) runs after sync navigation and
        //    getUserDetails fires with no token in localStorage.
        storeAccessTokenFromAuthResponse(result)

        dispatch(setCredentials({
          user: result.user,
        }))

        toast('Welcome back', {
          description: `Logged in as ${result.user.username}`,
        })
        form.reset()
        navigate(from, { replace: true })
      } else {
        toast('Login failed', {
          description: 'Invalid response from server',
        })
      }
    } catch (error: any) {
      console.error('Login error:', error)
      toast('Unable to sign in', {
        description: error?.data?.message || 'Invalid email or password',
      })
    }
  }

  return (
    <AuthLayout
      title="Welcome back!"
      subtitle="Log in to Vibely to continue sharing moments."
    >
      {/* Social Login Buttons */}
      <div className="space-y-3 mb-6">
        <SocialLoginButton
          provider="google"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        />
        <SocialLoginButton
          provider="github"
          onClick={handleGithubLogin}
          disabled={isLoading}
        />
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#0a0a0a] px-4 text-zinc-500 uppercase tracking-wider">
            Or
          </span>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-sm font-medium">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your email address"
                    className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    autoComplete="email"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-zinc-400 text-sm font-medium">
                    Password
                  </FormLabel>
                  <button
                    type="button"
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Your password"
                      className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 h-12 rounded-xl pr-12 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      autoComplete="current-password"
                      disabled={isLoading}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </span>
            ) : (
              'Log in'
            )}
          </Button>
        </form>
      </Form>

      {/* Sign Up Link */}
      <p className="text-center text-zinc-500 text-sm mt-8">
        Don't have an account?{' '}
        <Link
          to="/signup"
          className="text-white font-medium hover:text-violet-400 transition-colors underline underline-offset-4"
        >
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}

export default SignIn
