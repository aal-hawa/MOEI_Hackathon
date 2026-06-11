'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Phone, Mail, Globe, MapPin, Star, CheckCircle2,
  MessageSquare, Edit, BarChart3, Users,
} from 'lucide-react';
import type { BusinessProfile as BusinessProfileType } from '@/worker/whatsapp/types';

interface BusinessProfileProps {
  profile: BusinessProfileType;
}

export function BusinessProfile({ profile }: BusinessProfileProps) {
  return (
    <div className="flex flex-col h-full px-3 py-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center mb-4">
        <Avatar className="w-20 h-20 mb-3">
          <AvatarFallback className="bg-[#25D366] text-white font-bold text-2xl">
            {profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          <h3 className="text-[#e9edef] text-lg font-semibold">{profile.name}</h3>
          {profile.verified && (
            <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
          )}
        </div>
        <p className="text-[#8696a0] text-sm mt-1">{profile.phone}</p>
        {profile.industry && (
          <Badge className="bg-[#25D366]/20 text-[#25D366] text-xs mt-2 border-none">
            {profile.industry}
          </Badge>
        )}
      </div>

      {/* Rating */}
      {profile.rating && (
        <div className="bg-[#202c33] rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[#8696a0] text-xs">Business Rating</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.floor(profile.rating!)
                      ? 'text-amber-400 fill-amber-400'
                      : star <= profile.rating!
                      ? 'text-amber-400 fill-amber-400/50'
                      : 'text-[#2a3942]'
                  }`}
                />
              ))}
              <span className="text-[#e9edef] text-sm font-medium ml-1">{profile.rating}</span>
            </div>
          </div>
        </div>
      )}

      {/* About */}
      {profile.about && (
        <div className="bg-[#202c33] rounded-lg p-3 mb-3">
          <span className="text-[#8696a0] text-[10px] font-medium uppercase tracking-wider">About</span>
          <p className="text-[#e9edef] text-sm mt-1">{profile.about}</p>
        </div>
      )}

      {/* Description */}
      {profile.description && (
        <div className="bg-[#202c33] rounded-lg p-3 mb-3">
          <span className="text-[#8696a0] text-[10px] font-medium uppercase tracking-wider">Description</span>
          <p className="text-[#e9edef] text-sm mt-1">{profile.description}</p>
        </div>
      )}

      {/* Contact Info */}
      <div className="bg-[#202c33] rounded-lg p-3 mb-3">
        <span className="text-[#8696a0] text-[10px] font-medium uppercase tracking-wider">Contact Information</span>
        <div className="space-y-2.5 mt-2">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-[#25D366]" />
            <span className="text-[#e9edef] text-sm">{profile.phone}</span>
          </div>
          {profile.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#25D366]" />
              <span className="text-[#e9edef] text-sm">{profile.email}</span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-[#25D366]" />
              <span className="text-[#25D366] text-sm">{profile.website}</span>
            </div>
          )}
          {profile.address && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-[#25D366]" />
              <span className="text-[#e9edef] text-sm">{profile.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#202c33] rounded-lg p-3 mb-3">
        <span className="text-[#8696a0] text-[10px] font-medium uppercase tracking-wider">Quick Actions</span>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto py-3 text-[#e9edef] hover:bg-[#2a3942] rounded-lg">
            <MessageSquare className="w-5 h-5 text-[#25D366]" />
            <span className="text-[10px]">New Broadcast</span>
          </Button>
          <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto py-3 text-[#e9edef] hover:bg-[#2a3942] rounded-lg">
            <Users className="w-5 h-5 text-[#25D366]" />
            <span className="text-[10px]">Contacts</span>
          </Button>
          <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto py-3 text-[#e9edef] hover:bg-[#2a3942] rounded-lg">
            <BarChart3 className="w-5 h-5 text-[#25D366]" />
            <span className="text-[10px]">Analytics</span>
          </Button>
          <Button variant="ghost" className="flex flex-col items-center gap-1 h-auto py-3 text-[#e9edef] hover:bg-[#2a3942] rounded-lg">
            <Edit className="w-5 h-5 text-[#25D366]" />
            <span className="text-[10px]">Edit Profile</span>
          </Button>
        </div>
      </div>

      {/* API Status */}
      <div className="bg-[#202c33] rounded-lg p-3">
        <span className="text-[#8696a0] text-[10px] font-medium uppercase tracking-wider">API Status</span>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">Connected</span>
        </div>
        <div className="text-[#8696a0] text-[10px] mt-1">Phone Number ID: 1023456789</div>
        <div className="text-[#8696a0] text-[10px] mt-0.5">Business Account ID: 987654321</div>
      </div>
    </div>
  );
}
