# Page-Specific Data Fetching Implementation Summary

## Problem
The app was continuously requesting all data types (getHomeData, getSettingData, getSensorData) regardless of which page the user was on, causing:
- Backend overload with unnecessary requests
- Interference with settings updates
- Poor user experience with constant data fetching

## Solution
Implemented a page-specific data fetching system that:
1. **Dashboard Page**: Only requests `getHomeData` initially and periodically based on user-configured interval
2. **Settings Page**: Only requests `getSettingData` once on initial load and after updates
3. **Other Pages**: No automatic data fetching

## Changes Made

### 1. Created `usePageData` Hook (`src/hooks/usePageData.ts`)
- Manages page-specific data loading based on current route
- Handles periodic data fetching only for dashboard
- Automatically stops/starts data fetching when switching pages
- Respects user-configured sync intervals

### 2. Updated WebSocket Context (`src/context/WebSocketContext.tsx`)
- Removed global periodic data refresh interval
- Data fetching is now handled by individual pages
- Cleaner connection management

### 3. Updated Dashboard Component (`src/pages/Dashboard.tsx`)
- Integrated with `usePageData` hook
- Removed redundant settings data requests
- Only requests dashboard-specific data (`getHomeData`)
- Maintains user-configurable sync intervals

### 4. Updated Settings Component (`src/pages/Settings.tsx`)
- Integrated with `usePageData` hook
- Removed initial data loading (handled by hook)
- Only requests settings data after successful updates
- Increased delay for settings update confirmation

## Data Flow

### Dashboard Page
1. **Initial Load**: Request `getHomeData` once
2. **Periodic Updates**: Request `getHomeData` based on user-configured interval (2s, 5s, 10s, 30s, 1m, 5m, or off)
3. **Manual Sync**: User can trigger immediate sync
4. **Page Leave**: Stop all periodic requests

### Settings Page
1. **Initial Load**: Request `getSettingData` once
2. **After Update**: Request `getSettingData` after 1 second delay to confirm changes
3. **Page Leave**: No ongoing requests

### Other Pages
- No automatic data fetching
- Clean state management

## Benefits
1. **Reduced Backend Load**: Only necessary data is requested
2. **Better Settings Updates**: No interference from continuous data requests
3. **Improved Performance**: Page-specific data management
4. **User Control**: Configurable sync intervals for dashboard
5. **Clean State Management**: Proper cleanup when switching pages

## Configuration
- Dashboard sync interval can be configured in Settings page
- Stored in localStorage for persistence
- Default: 5 seconds
- Options: Off, 2s, 5s, 10s, 30s, 1m, 5m

## Testing
The implementation has been tested to ensure:
- Dashboard only requests home data periodically
- Settings only requests settings data when needed
- No data requests on other pages
- Proper cleanup when switching pages
- Settings updates work without interference
