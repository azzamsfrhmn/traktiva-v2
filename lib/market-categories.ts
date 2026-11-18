import {
  Baby, BedDouble, BookOpen, Car, CookingPot, Dumbbell, Footprints, Gamepad2, Gem, Glasses, Hammer, HeartPulse, House, Laptop, Luggage,
  PawPrint, Printer, Recycle, Refrigerator, Shirt, Smartphone, Smile, Sofa, Sparkles, Store, Tag, Tent, Ticket, Trophy, UtensilsCrossed,
  WashingMachine, Wine, Wrench, type LucideIcon,
} from "lucide-react";

// TikTok Shop level-1 categories (names as TikTok returns them) → Indonesian label + icon + tint.
// Unknown categories fall back to a tag icon with TikTok's own name.
const MAP: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  "Beauty & Personal Care": { label: "Kecantikan & Perawatan", icon: Sparkles, color: "#e535ab" },
  Kitchenware: { label: "Peralatan Dapur", icon: CookingPot, color: "#f2994a" },
  "Textiles & Soft Furnishings": { label: "Tekstil & Perlengkapan Tidur", icon: BedDouble, color: "#8b7cf6" },
  "Large Appliances": { label: "Elektronik Rumah Besar", icon: Refrigerator, color: "#4ea7fc" },
  "Commercial Appliances": { label: "Peralatan Usaha", icon: Store, color: "#26b5ce" },
  "Household Appliances": { label: "Elektronik Rumah Tangga", icon: WashingMachine, color: "#4ea7fc" },
  "Womenswear & Underwear": { label: "Pakaian Wanita", icon: Shirt, color: "#ff3b6b" },
  "Muslim Fashion": { label: "Fashion Muslim", icon: Shirt, color: "#2fa868" },
  Shoes: { label: "Sepatu", icon: Footprints, color: "#f2994a" },
  "Home Supplies": { label: "Perlengkapan Rumah", icon: House, color: "#4cb782" },
  "Phones & Electronics": { label: "HP & Elektronik", icon: Smartphone, color: "#4ea7fc" },
  "Computers & Office Equipment": { label: "Komputer & Kantor", icon: Laptop, color: "#5e6ad2" },
  "Pet Supplies": { label: "Perlengkapan Hewan", icon: PawPrint, color: "#f2994a" },
  "Baby & Maternity": { label: "Ibu & Bayi", icon: Baby, color: "#ff8fb1" },
  "Office Equipment and Supplies": { label: "Alat Tulis & Kantor", icon: Printer, color: "#5e6ad2" },
  "Sports & Outdoor": { label: "Olahraga", icon: Dumbbell, color: "#2fa868" },
  Outdoors: { label: "Outdoor & Camping", icon: Tent, color: "#4cb782" },
  "Toys & Hobbies": { label: "Mainan & Hobi", icon: Gamepad2, color: "#f2c94c" },
  Furniture: { label: "Furnitur", icon: Sofa, color: "#b07a4a" },
  "Tools & Hardware": { label: "Perkakas", icon: Wrench, color: "#8a8f98" },
  "Home Improvement": { label: "Renovasi Rumah", icon: Hammer, color: "#8a8f98" },
  "Automotive & Motorcycle": { label: "Otomotif & Motor", icon: Car, color: "#eb5757" },
  "Fashion Accessories": { label: "Aksesoris Fashion", icon: Glasses, color: "#e535ab" },
  "Food & Beverages": { label: "Makanan & Minuman", icon: UtensilsCrossed, color: "#f2994a" },
  "Liquor and Beverages": { label: "Minuman", icon: Wine, color: "#a33b5c" },
  Health: { label: "Kesehatan", icon: HeartPulse, color: "#eb5757" },
  "Books, Magazines & Audio": { label: "Buku & Media", icon: BookOpen, color: "#5e6ad2" },
  "Kids' Fashion": { label: "Pakaian Anak", icon: Smile, color: "#f2c94c" },
  "Menswear & Underwear": { label: "Pakaian Pria", icon: Shirt, color: "#4ea7fc" },
  "Luggage & Bags": { label: "Tas & Koper", icon: Luggage, color: "#b07a4a" },
  "Virtual Products": { label: "Produk Digital", icon: Ticket, color: "#26b5ce" },
  "Pre-Owned": { label: "Barang Bekas", icon: Recycle, color: "#4cb782" },
  Collectibles: { label: "Koleksi", icon: Trophy, color: "#f2c94c" },
  "Jewelry Accessories & Derivatives": { label: "Perhiasan", icon: Gem, color: "#8b7cf6" },
  "Bookings and coupons": { label: "Voucher & Pemesanan", icon: Ticket, color: "#2fa868" },
};

export const categoryMeta = (name: string) => MAP[name] ?? { label: name, icon: Tag, color: "#8a8f98" };
