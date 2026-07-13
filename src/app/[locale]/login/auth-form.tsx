"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react"

// ──────────────────────────────────────────────
// Friendly error message mapping
// ──────────────────────────────────────────────
function getFriendlyError(errorMessage: string): string {
  const msg = errorMessage.toLowerCase()

  if (msg.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again."
  }
  if (msg.includes("email not confirmed")) {
    return "Please verify your email address before signing in. Check your inbox."
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead."
  }
  if (msg.includes("password") && msg.includes("least")) {
    return "Password must be at least 6 characters long."
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again."
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Please check your connection and try again."
  }
  if (msg.includes("invalid email")) {
    return "Please enter a valid email address."
  }

  return errorMessage
}

// ──────────────────────────────────────────────
// Sign In Form
// ──────────────────────────────────────────────
function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setError(getFriendlyError(error.message))
        setLoading(false)
        return
      }

      // Success — show brief success state, then do a FULL page reload.
      // This ensures the proxy refreshes the session cookie and
      // Next.js server components pick up the authenticated state.
      setSuccess(true)
      
      // Small delay so user sees the success state before redirect
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 400)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }, [email, password, supabase.auth])

  return (
    <form onSubmit={handleSignIn} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading || success}
          autoComplete="email"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <div className="relative">
          <Input
            id="signin-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading || success}
            autoComplete="current-password"
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-11 text-sm font-medium"
        disabled={loading || success}
      >
        {success ? (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Signed in! Redirecting…
          </span>
        ) : loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </span>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  )
}

// ──────────────────────────────────────────────
// Sign Up Form
// ──────────────────────────────────────────────
function SignUpForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const supabase = createClient()

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Client-side validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      setLoading(false)
      return
    }

    if (!fullName.trim()) {
      setError("Please enter your full name.")
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })

      if (error) {
        setError(getFriendlyError(error.message))
        setLoading(false)
        return
      }

      // Check if Supabase requires email confirmation.
      // If identities array is empty, email confirmation is required
      // but the user already exists (duplicate signup attempt).
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try signing in instead.")
        setLoading(false)
        return
      }

      // If the session is null, email confirmation is required
      if (!data.session) {
        setEmailSent(true)
        setLoading(false)
        return
      }

      // If we got a session immediately (email confirmation disabled),
      // redirect with full reload
      window.location.href = "/dashboard"
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }, [email, password, fullName, supabase.auth])

  // ── Email Confirmation Sent State ──
  if (emailSent) {
    return (
      <div className="mt-4 flex flex-col items-center text-center py-6 space-y-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Check your email</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            We&apos;ve sent a verification link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Click the link to activate your account.
          </p>
        </div>
        <button
          onClick={() => setEmailSent(false)}
          className="text-sm text-primary hover:underline underline-offset-4 mt-2"
        >
          ← Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSignUp} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="signup-fullname">Full Name</Label>
        <Input
          id="signup-fullname"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={loading}
          autoComplete="name"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            autoComplete="new-password"
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password.length > 0 && password.length < 6 && (
          <p className="text-xs text-muted-foreground">
            {6 - password.length} more character{6 - password.length !== 1 ? "s" : ""} needed
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-11 text-sm font-medium"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account…
          </span>
        ) : (
          "Create Account"
        )}
      </Button>
    </form>
  )
}

// ──────────────────────────────────────────────
// Main Auth Form (exported)
// ──────────────────────────────────────────────
export function AuthForm() {
  return (
    <Card className="w-full bg-white/60 dark:bg-black/40 backdrop-blur-xl border-border/50 shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-serif text-center">Welcome</CardTitle>
        <CardDescription className="text-center">
          Sign in or create an account to continue
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <SignInForm />
          </TabsContent>

          <TabsContent value="signup">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
