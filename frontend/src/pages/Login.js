import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Lock, User, AlertCircle } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [logoutReason, setLogoutReason] = useState('');
  const { login, loading } = useAuth();
  const { clubName, hasLogo, logoUrl } = useBranding();
  const navigate = useNavigate();

  useEffect(() => {
    // Prüfe ob es einen Logout-Grund gibt
    const reason = sessionStorage.getItem('logoutReason');
    if (reason) {
      setLogoutReason(reason);
      sessionStorage.removeItem('logoutReason');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLogoutReason('');
    const result = await login(username, password);
    if (result.success) {
      toast.success('Login erfolgreich!');
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Benutzername oder Passwort falsch');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1761829918692-af78306f22c0?crop=entropy&cs=srgb&fm=jpg&q=85')` }}
      />
      <div className="absolute inset-0 bg-emerald-900/40 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-stone-200">
          <div className="flex items-center justify-center mb-6">
            <img 
              src={hasLogo ? logoUrl : '/logo.png'} 
              alt={clubName} 
              className="w-48 h-48 object-contain"
            />
          </div>
          
          <h1 className="text-4xl font-bold text-center mb-2 text-stone-900 tracking-tight">
            {clubName}
          </h1>
          <p className="text-center text-stone-500 mb-8">
            Verwaltung
          </p>

          {logoutReason && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{logoutReason}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-stone-700 font-medium">
                Benutzername
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <Input
                  data-testid="login-username-input"
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Benutzername eingeben"
                  className="pl-12 h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-stone-700 font-medium">
                Passwort
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <Input
                  data-testid="login-password-input"
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben"
                  className="pl-12 h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                  required
                />
              </div>
            </div>

            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20 text-base"
            >
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Login;