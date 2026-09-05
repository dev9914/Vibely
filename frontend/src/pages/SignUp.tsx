import { Link, useNavigate } from 'react-router-dom'
import { useRegisterMutation } from '../services/userApi'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema } from '../lib/validations'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/authSlice'
import { Eye, EyeOff, Loader2, User, X, Check } from 'lucide-react'
import { useState, useRef } from 'react'
import { AuthLayout, SocialLoginButton } from '../components/auth'
import { storeAccessTokenFromAuthResponse } from '../lib/authToken'

/**
 * SignUp Page
 * Premium split-screen layout with phone mockup hero
 */
const SignUp = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [register, { isLoading }] = useRegisterMutation()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      avatar: undefined,
    },
  })

  // Password validation states
  const password = form.watch('password')
  const passwordChecks = {
    length: password?.length >= 6,
    uppercase: /[A-Z]/.test(password || ''),
    lowercase: /[a-z]/.test(password || ''),
    number: /[0-9]/.test(password || ''),
  }

  const handleGoogleSignUp = () => {
    toast('Coming soon', {
      description: 'Google signup will be available shortly',
    })
    // TODO: Implement Google OAuth
  }

  const handleGithubSignUp = () => {
    toast('Coming soon', {
      description: 'GitHub signup will be available shortly',
    })
    // TODO: Implement GitHub OAuth
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      form.setValue('avatar', file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeAvatar = () => {
    form.setValue('avatar', undefined)
    setAvatarPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const onSubmit = async (data: any) => {
    try {
      const formData = new FormData()
      formData.append('username', data.username)
      formData.append('email', data.email)
      formData.append('password', data.password)
      formData.append('fullName', data.fullName)

      if (data.avatar) {
        formData.append('avatar', data.avatar)
      }

      const result = await register(formData).unwrap()

      if (result?.user) {
        // ⚡ SYNC token save BEFORE navigate — prevents race with post-nav queries
        storeAccessTokenFromAuthResponse(result)

        dispatch(setCredentials({
          user: result.user,
        }))
        toast('Account created', {
          description: `Welcome to Vibely, ${result.user.username}!`,
        })
        form.reset()
        navigate('/')
      } else {
        toast('Registration failed', {
          description: 'Invalid response from server',
        })
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      toast('Unable to create account', {
        description: error?.data?.message || 'Please try again',
      })
    }
  }

  return (
    <AuthLayout
      title="Join Vibely"
      subtitle="Create your account and start sharing moments."
    >
      {/* Social Login Buttons */}
      <div className="space-y-3 mb-5">
        <SocialLoginButton
          provider="google"
          onClick={handleGoogleSignUp}
          disabled={isLoading}
        />
        <SocialLoginButton
          provider="github"
          onClick={handleGithubSignUp}
          disabled={isLoading}
        />
      </div>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#0a0a0a] px-4 text-zinc-500 uppercase tracking-wider">
            Or
          </span>
        </div>
      </div>

      {/* Avatar Upload */}
      <div className="flex justify-center mb-5">
        <div className="relative">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full bg-zinc-900/50 border-2 border-dashed border-zinc-700 flex items-center justify-center cursor-pointer hover:border-violet-500 transition-all overflow-hidden group"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-zinc-500 group-hover:text-violet-400 transition-colors">
                <User className="h-6 w-6 mb-1" />
                <span className="text-xs">Photo</span>
              </div>
            )}
          </div>
          {avatarPreview && (
            <button
              type="button"
              onClick={removeAvatar}
              className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {/* Username & Full Name Row */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-400 text-sm font-medium">
                    Username
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="johndoe"
                      className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 h-11 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      autoComplete="username"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-400 text-sm font-medium">
                    Full Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 h-11 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      autoComplete="name"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-red-400 text-xs" />
                </FormItem>
              )}
            />
          </div>

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
                    placeholder="you@example.com"
                    className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 h-11 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
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
                <FormLabel className="text-zinc-400 text-sm font-medium">
                  Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 h-11 rounded-xl pr-12 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Confirm Password Field */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-400 text-sm font-medium">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 h-11 rounded-xl pr-12 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-red-400 text-xs" />
              </FormItem>
            )}
          />

          {/* Password Requirements - Visual Checklist */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`flex items-center gap-1.5 ${passwordChecks.length ? 'text-green-400' : 'text-zinc-500'}`}>
              <Check className={`h-3 w-3 ${passwordChecks.length ? 'opacity-100' : 'opacity-40'}`} />
              6+ characters
            </div>
            <div className={`flex items-center gap-1.5 ${passwordChecks.uppercase ? 'text-green-400' : 'text-zinc-500'}`}>
              <Check className={`h-3 w-3 ${passwordChecks.uppercase ? 'opacity-100' : 'opacity-40'}`} />
              Uppercase
            </div>
            <div className={`flex items-center gap-1.5 ${passwordChecks.lowercase ? 'text-green-400' : 'text-zinc-500'}`}>
              <Check className={`h-3 w-3 ${passwordChecks.lowercase ? 'opacity-100' : 'opacity-40'}`} />
              Lowercase
            </div>
            <div className={`flex items-center gap-1.5 ${passwordChecks.number ? 'text-green-400' : 'text-zinc-500'}`}>
              <Check className={`h-3 w-3 ${passwordChecks.number ? 'opacity-100' : 'opacity-40'}`} />
              Number
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating account...
              </span>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      </Form>

      {/* Sign In Link */}
      <p className="text-center text-zinc-500 text-sm mt-6">
        Already have an account?{' '}
        <Link
          to="/signin"
          className="text-white font-medium hover:text-violet-400 transition-colors underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>

      {/* Terms */}
      <p className="text-center text-zinc-600 text-xs mt-4">
        By creating an account, you agree to our{' '}
        <span className="text-zinc-400 hover:text-violet-400 cursor-pointer transition-colors">Terms</span>
        {' '}and{' '}
        <span className="text-zinc-400 hover:text-violet-400 cursor-pointer transition-colors">Privacy Policy</span>
      </p>
    </AuthLayout>
  )
}

export default SignUp
