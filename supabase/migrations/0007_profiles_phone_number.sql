-- Migration: add optional phone number to user profiles

alter table public.profiles
  add column if not exists phone_number text;
