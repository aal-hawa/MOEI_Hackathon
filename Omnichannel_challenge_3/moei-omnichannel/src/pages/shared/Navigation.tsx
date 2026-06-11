'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Mail, Settings, Bell, Moon, Sun, User, HelpCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type PageType = 'whatsapp' | 'email';

interface Notification {
  id: string;
  message: string;
  time: string;
}

interface NavigationProps {
  activePage: PageType;
  onPageChange: (page: PageType) => void;
  unreadWhatsApp?: number;
  unreadEmail?: number;
}

export function Navigation({ activePage, onPageChange, unreadWhatsApp = 0, unreadEmail = 0 }: NavigationProps) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 'n1', message: 'Ahmed sent you a message', time: '2m ago' },
    { id: 'n2', message: 'New email from Sara Mohammed', time: '15m ago' },
    { id: 'n3', message: 'Omar is now online', time: '1h ago' },
  ]);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleBellClick = () => {
    setHasUnreadNotifications(false);
  };

  const handleDarkModeToggle = () => {
    setDarkMode(prev => !prev);
    toast({ title: 'Theme toggled', duration: 2000 });
  };

  return (
    <nav className="flex items-center justify-between px-4 py-2 bg-[#1a1a2e] border-b border-[#2a2a4a]">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
          Z
        </div>
        <span className="text-white font-semibold text-lg hidden sm:block">CommHub</span>
      </div>

      {/* Page Tabs */}
      <div className="flex items-center gap-1 bg-[#16213e] rounded-xl p-1">
        <Button
          onClick={() => onPageChange('whatsapp')}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-all ${
            activePage === 'whatsapp'
              ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30'
              : 'text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">WhatsApp</span>
          {unreadWhatsApp > 0 && (
            <Badge className={`text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center ${
              activePage === 'whatsapp' ? 'bg-white/20 text-white' : 'bg-[#25D366] text-white'
            }`}>
              {unreadWhatsApp}
            </Badge>
          )}
        </Button>
        <Button
          onClick={() => onPageChange('email')}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-all ${
            activePage === 'email'
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
              : 'text-[#8696a0] hover:text-white hover:bg-[#2a3942]'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span className="hidden sm:inline">Email</span>
          {unreadEmail > 0 && (
            <Badge className={`text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center ${
              activePage === 'email' ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
            }`}>
              {unreadEmail}
            </Badge>
          )}
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Bell - Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#8696a0] hover:text-white hover:bg-[#2a3942] h-8 w-8 relative"
              onClick={handleBellClick}
            >
              <Bell className="w-4 h-4" />
              {hasUnreadNotifications && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 bg-[#1a1a2e] border-[#2a2a4a]">
            <div className="px-4 py-3 border-b border-[#2a2a4a]">
              <h4 className="text-sm font-semibold text-white">Notifications</h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-[#8696a0] text-sm">
                  No new notifications
                </div>
              ) : (
                <div className="divide-y divide-[#2a2a4a]">
                  {notifications.map(notification => (
                    <div key={notification.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#2a2a4a]/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{notification.message}</p>
                        <p className="text-xs text-[#8696a0] mt-0.5">{notification.time}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-[#8696a0] hover:text-white hover:bg-[#2a3942] px-2 shrink-0"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        Mark as read
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Settings - Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-[#8696a0] hover:text-white hover:bg-[#2a3942] h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#1a1a2e] border-[#2a2a4a]">
            <DropdownMenuCheckboxItem
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
              className="text-white focus:bg-[#2a3942] focus:text-white"
            >
              {darkMode ? <Moon className="w-4 h-4 mr-2" /> : <Sun className="w-4 h-4 mr-2" />}
              Dark mode
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator className="bg-[#2a2a4a]" />
            <DropdownMenuItem
              className="text-white focus:bg-[#2a3942] focus:text-white cursor-pointer"
              onClick={() => toast({ title: 'Profile settings coming soon', duration: 2000 })}
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-white focus:bg-[#2a3942] focus:text-white cursor-pointer"
              onClick={() => toast({ title: 'Help center coming soon', duration: 2000 })}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Help
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
