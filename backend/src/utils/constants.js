// Business rules carried over unchanged from the original prototype.

const RADII = { critical: [5, 15, 30, 60], moderate: [3, 10, 20, 40], mild: [2, 5, 15, 30] };
const POINTS = { critical: 30, moderate: 20, mild: 10 };

const MILESTONES = [
  { pts: 50, label: 'First Rescuer', icon: '🐾' },
  { pts: 200, label: 'Animal Guardian', icon: '🛡️' },
  { pts: 500, label: 'Rescue Hero', icon: '🌟' },
  { pts: 1000, label: 'Lifesaver Legend', icon: '🏆' }
];

const ANIMAL_TYPES = ['Dog', 'Cat', 'Bird', 'Cow', 'Horse', 'Other'];
const SEVERITIES = ['critical', 'moderate', 'mild'];
const STATUSES = ['reported', 'accepted', 'onway', 'rescued', 'completed'];

const STATUS_LABELS = {
  reported: 'Reported', accepted: 'Accepted', onway: 'On the Way', rescued: 'Rescued', completed: 'Completed'
};
const TIMELINE_LABELS = { onway: 'On the Way', rescued: 'Rescued', completed: 'Completed / Under Treatment' };

const RESPONDER_TYPES = { ngo: 'NGO Team', vet: 'Veterinarian', volunteer: 'Volunteer' };

const NGO_UPI = {
  'Chennai Animal Welfare Society': 'caws@upi',
  'Blue Cross of India': 'bluecross@ybl',
  'CARE — Animal Rescue': 'carerescue@paytm',
  'General Rescue Fund': 'straycare.fund@upi'
};

const DISPATCH_UNITS = ['General Mobile Unit', 'Blue Cross Emergency', 'Dr. Ramesh (Vet)'];

module.exports = {
  RADII, POINTS, MILESTONES, ANIMAL_TYPES, SEVERITIES, STATUSES, STATUS_LABELS,
  TIMELINE_LABELS, RESPONDER_TYPES, NGO_UPI, DISPATCH_UNITS
};
