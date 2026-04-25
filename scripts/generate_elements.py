import json

# Periodic table data for all 118 elements
# Sources: NIST, IUPAC standard data

elements_data = [
    # Period 1
    (1, "H", "Hydrogen", 1, 1, "s", "nonmetal", 1.008, "gas", [1], 1, [1, -1], 2.20, "#3b82f6"),
    (2, "He", "Helium", 18, 1, "s", "noble-gas", 4.0026, "gas", [2], 2, [0], None, "#06b6d4"),
    # Period 2
    (3, "Li", "Lithium", 1, 2, "s", "alkali-metal", 6.94, "solid", [2, 1], 1, [1], 0.98, "#ef4444"),
    (4, "Be", "Beryllium", 2, 2, "s", "alkaline-earth-metal", 9.0122, "solid", [2, 2], 2, [2], 1.57, "#f97316"),
    (5, "B", "Boron", 13, 2, "p", "metalloid", 10.81, "solid", [2, 3], 3, [3], 2.04, "#84cc16"),
    (6, "C", "Carbon", 14, 2, "p", "nonmetal", 12.011, "solid", [2, 4], 4, [-4, 2, 4], 2.55, "#1e293b"),
    (7, "N", "Nitrogen", 15, 2, "p", "nonmetal", 14.007, "gas", [2, 5], 5, [-3, 3, 5], 3.04, "#3b82f6"),
    (8, "O", "Oxygen", 16, 2, "p", "nonmetal", 15.999, "gas", [2, 6], 6, [-2], 3.44, "#ef4444"),
    (9, "F", "Fluorine", 17, 2, "p", "halogen", 18.998, "gas", [2, 7], 7, [-1], 3.98, "#8b5cf6"),
    (10, "Ne", "Neon", 18, 2, "p", "noble-gas", 20.180, "gas", [2, 8], 8, [0], None, "#06b6d4"),
    # Period 3
    (11, "Na", "Sodium", 1, 3, "s", "alkali-metal", 22.990, "solid", [2, 8, 1], 1, [1], 0.93, "#dc2626"),
    (12, "Mg", "Magnesium", 2, 3, "s", "alkaline-earth-metal", 24.305, "solid", [2, 8, 2], 2, [2], 1.31, "#f97316"),
    (13, "Al", "Aluminum", 13, 3, "p", "post-transition-metal", 26.982, "solid", [2, 8, 3], 3, [3], 1.61, "#a8a29e"),
    (14, "Si", "Silicon", 14, 3, "p", "metalloid", 28.085, "solid", [2, 8, 4], 4, [4, -4], 1.90, "#84cc16"),
    (15, "P", "Phosphorus", 15, 3, "p", "nonmetal", 30.974, "solid", [2, 8, 5], 5, [-3, 3, 5], 2.19, "#f59e0b"),
    (16, "S", "Sulfur", 16, 3, "p", "nonmetal", 32.06, "solid", [2, 8, 6], 6, [-2, 4, 6], 2.58, "#eab308"),
    (17, "Cl", "Chlorine", 17, 3, "p", "halogen", 35.45, "gas", [2, 8, 7], 7, [-1, 1, 3, 5, 7], 3.16, "#8b5cf6"),
    (18, "Ar", "Argon", 18, 3, "p", "noble-gas", 39.948, "gas", [2, 8, 8], 8, [0], None, "#06b6d4"),
    # Period 4
    (19, "K", "Potassium", 1, 4, "s", "alkali-metal", 39.098, "solid", [2, 8, 8, 1], 1, [1], 0.82, "#ef4444"),
    (20, "Ca", "Calcium", 2, 4, "s", "alkaline-earth-metal", 40.078, "solid", [2, 8, 8, 2], 2, [2], 1.00, "#f97316"),
    (21, "Sc", "Scandium", 3, 4, "d", "transition-metal", 44.956, "solid", [2, 8, 9, 2], 2, [3], 1.36, "#f59e0b"),
    (22, "Ti", "Titanium", 4, 4, "d", "transition-metal", 47.867, "solid", [2, 8, 10, 2], 2, [2, 3, 4], 1.54, "#f59e0b"),
    (23, "V", "Vanadium", 5, 4, "d", "transition-metal", 50.942, "solid", [2, 8, 11, 2], 2, [2, 3, 4, 5], 1.63, "#f59e0b"),
    (24, "Cr", "Chromium", 6, 4, "d", "transition-metal", 51.996, "solid", [2, 8, 13, 1], 1, [2, 3, 6], 1.66, "#f59e0b"),
    (25, "Mn", "Manganese", 7, 4, "d", "transition-metal", 54.938, "solid", [2, 8, 13, 2], 2, [2, 3, 4, 6, 7], 1.55, "#f59e0b"),
    (26, "Fe", "Iron", 8, 4, "d", "transition-metal", 55.845, "solid", [2, 8, 14, 2], 2, [2, 3], 1.83, "#f59e0b"),
    (27, "Co", "Cobalt", 9, 4, "d", "transition-metal", 58.933, "solid", [2, 8, 15, 2], 2, [2, 3], 1.88, "#f59e0b"),
    (28, "Ni", "Nickel", 10, 4, "d", "transition-metal", 58.693, "solid", [2, 8, 16, 2], 2, [2, 3], 1.91, "#f59e0b"),
    (29, "Cu", "Copper", 11, 4, "d", "transition-metal", 63.546, "solid", [2, 8, 18, 1], 1, [1, 2], 1.90, "#f59e0b"),
    (30, "Zn", "Zinc", 12, 4, "d", "transition-metal", 65.38, "solid", [2, 8, 18, 2], 2, [2], 1.65, "#f59e0b"),
    (31, "Ga", "Gallium", 13, 4, "p", "post-transition-metal", 69.723, "solid", [2, 8, 18, 3], 3, [3], 1.81, "#a8a29e"),
    (32, "Ge", "Germanium", 14, 4, "p", "metalloid", 72.630, "solid", [2, 8, 18, 4], 4, [4, -4], 2.01, "#84cc16"),
    (33, "As", "Arsenic", 15, 4, "p", "metalloid", 74.922, "solid", [2, 8, 18, 5], 5, [-3, 3, 5], 2.18, "#84cc16"),
    (34, "Se", "Selenium", 16, 4, "p", "nonmetal", 78.96, "solid", [2, 8, 18, 6], 6, [-2, 4, 6], 2.55, "#3b82f6"),
    (35, "Br", "Bromine", 17, 4, "p", "halogen", 79.904, "liquid", [2, 8, 18, 7], 7, [-1, 1, 3, 5], 2.96, "#8b5cf6"),
    (36, "Kr", "Krypton", 18, 4, "p", "noble-gas", 83.798, "gas", [2, 8, 18, 8], 8, [0], 3.00, "#06b6d4"),
    # Period 5
    (37, "Rb", "Rubidium", 1, 5, "s", "alkali-metal", 85.468, "solid", [2, 8, 18, 8, 1], 1, [1], 0.82, "#ef4444"),
    (38, "Sr", "Strontium", 2, 5, "s", "alkaline-earth-metal", 87.62, "solid", [2, 8, 18, 8, 2], 2, [2], 0.95, "#f97316"),
    (39, "Y", "Yttrium", 3, 5, "d", "transition-metal", 88.906, "solid", [2, 8, 18, 9, 2], 2, [3], 1.22, "#f59e0b"),
    (40, "Zr", "Zirconium", 4, 5, "d", "transition-metal", 91.224, "solid", [2, 8, 18, 10, 2], 2, [4], 1.33, "#f59e0b"),
    (41, "Nb", "Niobium", 5, 5, "d", "transition-metal", 92.906, "solid", [2, 8, 18, 12, 1], 1, [3, 5], 1.6, "#f59e0b"),
    (42, "Mo", "Molybdenum", 6, 5, "d", "transition-metal", 95.95, "solid", [2, 8, 18, 13, 1], 1, [2, 3, 4, 5, 6], 2.16, "#f59e0b"),
    (43, "Tc", "Technetium", 7, 5, "d", "transition-metal", 98, "solid", [2, 8, 18, 13, 2], 2, [4, 7], 1.9, "#f59e0b"),
    (44, "Ru", "Ruthenium", 8, 5, "d", "transition-metal", 101.07, "solid", [2, 8, 18, 15, 1], 1, [2, 3, 4, 6, 8], 2.2, "#f59e0b"),
    (45, "Rh", "Rhodium", 9, 5, "d", "transition-metal", 102.91, "solid", [2, 8, 18, 16, 1], 1, [3], 2.28, "#f59e0b"),
    (46, "Pd", "Palladium", 10, 5, "d", "transition-metal", 106.42, "solid", [2, 8, 18, 18], 0, [2, 4], 2.20, "#f59e0b"),
    (47, "Ag", "Silver", 11, 5, "d", "transition-metal", 107.87, "solid", [2, 8, 18, 18, 1], 1, [1], 1.93, "#f59e0b"),
    (48, "Cd", "Cadmium", 12, 5, "d", "transition-metal", 112.41, "solid", [2, 8, 18, 18, 2], 2, [2], 1.69, "#f59e0b"),
    (49, "In", "Indium", 13, 5, "p", "post-transition-metal", 114.82, "solid", [2, 8, 18, 18, 3], 3, [3], 1.78, "#a8a29e"),
    (50, "Sn", "Tin", 14, 5, "p", "post-transition-metal", 118.71, "solid", [2, 8, 18, 18, 4], 4, [2, 4], 1.96, "#a8a29e"),
    (51, "Sb", "Antimony", 15, 5, "p", "metalloid", 121.76, "solid", [2, 8, 18, 18, 5], 5, [-3, 3, 5], 2.05, "#84cc16"),
    (52, "Te", "Tellurium", 16, 5, "p", "metalloid", 127.60, "solid", [2, 8, 18, 18, 6], 6, [-2, 4, 6], 2.1, "#84cc16"),
    (53, "I", "Iodine", 17, 5, "p", "halogen", 126.90, "solid", [2, 8, 18, 18, 7], 7, [-1, 1, 3, 5, 7], 2.66, "#8b5cf6"),
    (54, "Xe", "Xenon", 18, 5, "p", "noble-gas", 131.29, "gas", [2, 8, 18, 18, 8], 8, [0], 2.6, "#06b6d4"),
    # Period 6
    (55, "Cs", "Cesium", 1, 6, "s", "alkali-metal", 132.91, "solid", [2, 8, 18, 18, 8, 1], 1, [1], 0.79, "#ef4444"),
    (56, "Ba", "Barium", 2, 6, "s", "alkaline-earth-metal", 137.33, "solid", [2, 8, 18, 18, 8, 2], 2, [2], 0.89, "#f97316"),
    (57, "La", "Lanthanum", 3, 6, "d", "lanthanide", 138.91, "solid", [2, 8, 18, 18, 9, 2], 2, [3], 1.10, "#ec4899"),
    (58, "Ce", "Cerium", None, 6, "f", "lanthanide", 140.12, "solid", [2, 8, 18, 19, 9, 2], 2, [3, 4], 1.12, "#ec4899"),
    (59, "Pr", "Praseodymium", None, 6, "f", "lanthanide", 140.91, "solid", [2, 8, 18, 21, 8, 2], 2, [3], 1.13, "#ec4899"),
    (60, "Nd", "Neodymium", None, 6, "f", "lanthanide", 144.24, "solid", [2, 8, 18, 22, 8, 2], 2, [3], 1.14, "#ec4899"),
    (61, "Pm", "Promethium", None, 6, "f", "lanthanide", 145, "solid", [2, 8, 18, 23, 8, 2], 2, [3], 1.13, "#ec4899"),
    (62, "Sm", "Samarium", None, 6, "f", "lanthanide", 150.36, "solid", [2, 8, 18, 24, 8, 2], 2, [2, 3], 1.17, "#ec4899"),
    (63, "Eu", "Europium", None, 6, "f", "lanthanide", 151.96, "solid", [2, 8, 18, 25, 8, 2], 2, [2, 3], 1.2, "#ec4899"),
    (64, "Gd", "Gadolinium", None, 6, "f", "lanthanide", 157.25, "solid", [2, 8, 18, 25, 9, 2], 2, [3], 1.20, "#ec4899"),
    (65, "Tb", "Terbium", None, 6, "f", "lanthanide", 158.93, "solid", [2, 8, 18, 27, 8, 2], 2, [3], 1.2, "#ec4899"),
    (66, "Dy", "Dysprosium", None, 6, "f", "lanthanide", 162.50, "solid", [2, 8, 18, 28, 8, 2], 2, [3], 1.22, "#ec4899"),
    (67, "Ho", "Holmium", None, 6, "f", "lanthanide", 164.93, "solid", [2, 8, 18, 29, 8, 2], 2, [3], 1.23, "#ec4899"),
    (68, "Er", "Erbium", None, 6, "f", "lanthanide", 167.26, "solid", [2, 8, 18, 30, 8, 2], 2, [3], 1.24, "#ec4899"),
    (69, "Tm", "Thulium", None, 6, "f", "lanthanide", 168.93, "solid", [2, 8, 18, 31, 8, 2], 2, [2, 3], 1.25, "#ec4899"),
    (70, "Yb", "Ytterbium", None, 6, "f", "lanthanide", 173.05, "solid", [2, 8, 18, 32, 8, 2], 2, [2, 3], 1.1, "#ec4899"),
    (71, "Lu", "Lutetium", None, 6, "f", "lanthanide", 174.97, "solid", [2, 8, 18, 32, 9, 2], 2, [3], 1.27, "#ec4899"),
    (72, "Hf", "Hafnium", 4, 6, "d", "transition-metal", 178.49, "solid", [2, 8, 18, 32, 10, 2], 2, [4], 1.3, "#f59e0b"),
    (73, "Ta", "Tantalum", 5, 6, "d", "transition-metal", 180.95, "solid", [2, 8, 18, 32, 11, 2], 2, [5], 1.5, "#f59e0b"),
    (74, "W", "Tungsten", 6, 6, "d", "transition-metal", 183.84, "solid", [2, 8, 18, 32, 12, 2], 2, [2, 4, 6], 2.36, "#f59e0b"),
    (75, "Re", "Rhenium", 7, 6, "d", "transition-metal", 186.21, "solid", [2, 8, 18, 32, 13, 2], 2, [4, 6, 7], 1.9, "#f59e0b"),
    (76, "Os", "Osmium", 8, 6, "d", "transition-metal", 190.23, "solid", [2, 8, 18, 32, 14, 2], 2, [4], 2.2, "#f59e0b"),
    (77, "Ir", "Iridium", 9, 6, "d", "transition-metal", 192.22, "solid", [2, 8, 18, 32, 15, 2], 2, [3, 4], 2.20, "#f59e0b"),
    (78, "Pt", "Platinum", 10, 6, "d", "transition-metal", 195.08, "solid", [2, 8, 18, 32, 17, 1], 1, [2, 4], 2.28, "#f59e0b"),
    (79, "Au", "Gold", 11, 6, "d", "transition-metal", 196.97, "solid", [2, 8, 18, 32, 18, 1], 1, [1, 3], 2.54, "#f59e0b"),
    (80, "Hg", "Mercury", 12, 6, "d", "transition-metal", 200.59, "liquid", [2, 8, 18, 32, 18, 2], 2, [1, 2], 2.00, "#f59e0b"),
    (81, "Tl", "Thallium", 13, 6, "p", "post-transition-metal", 204.38, "solid", [2, 8, 18, 32, 18, 3], 3, [1, 3], 1.62, "#a8a29e"),
    (82, "Pb", "Lead", 14, 6, "p", "post-transition-metal", 207.2, "solid", [2, 8, 18, 32, 18, 4], 4, [2, 4], 2.33, "#a8a29e"),
    (83, "Bi", "Bismuth", 15, 6, "p", "post-transition-metal", 208.98, "solid", [2, 8, 18, 32, 18, 5], 5, [3, 5], 2.02, "#a8a29e"),
    (84, "Po", "Polonium", 16, 6, "p", "post-transition-metal", 209, "solid", [2, 8, 18, 32, 18, 6], 6, [2, 4], 2.0, "#a8a29e"),
    (85, "At", "Astatine", 17, 6, "p", "halogen", 210, "solid", [2, 8, 18, 32, 18, 7], 7, [-1, 1, 3, 5], 2.2, "#8b5cf6"),
    (86, "Rn", "Radon", 18, 6, "p", "noble-gas", 222, "gas", [2, 8, 18, 32, 18, 8], 8, [0], None, "#06b6d4"),
    # Period 7
    (87, "Fr", "Francium", 1, 7, "s", "alkali-metal", 223, "solid", [2, 8, 18, 32, 18, 8, 1], 1, [1], 0.7, "#ef4444"),
    (88, "Ra", "Radium", 2, 7, "s", "alkaline-earth-metal", 226, "solid", [2, 8, 18, 32, 18, 8, 2], 2, [2], 0.9, "#f97316"),
    (89, "Ac", "Actinium", 3, 7, "d", "actinide", 227, "solid", [2, 8, 18, 32, 18, 9, 2], 2, [3], 1.1, "#d946ef"),
    (90, "Th", "Thorium", None, 7, "f", "actinide", 232.04, "solid", [2, 8, 18, 32, 18, 10, 2], 2, [4], 1.3, "#d946ef"),
    (91, "Pa", "Protactinium", None, 7, "f", "actinide", 231.04, "solid", [2, 8, 18, 32, 20, 9, 2], 2, [4, 5], 1.5, "#d946ef"),
    (92, "U", "Uranium", None, 7, "f", "actinide", 238.03, "solid", [2, 8, 18, 32, 21, 9, 2], 2, [3, 4, 5, 6], 1.38, "#d946ef"),
    (93, "Np", "Neptunium", None, 7, "f", "actinide", 237, "solid", [2, 8, 18, 32, 22, 9, 2], 2, [3, 4, 5, 6], 1.36, "#d946ef"),
    (94, "Pu", "Plutonium", None, 7, "f", "actinide", 244, "solid", [2, 8, 18, 32, 24, 8, 2], 2, [3, 4, 5, 6], 1.28, "#d946ef"),
    (95, "Am", "Americium", None, 7, "f", "actinide", 243, "solid", [2, 8, 18, 32, 25, 8, 2], 2, [3, 4, 5, 6], 1.13, "#d946ef"),
    (96, "Cm", "Curium", None, 7, "f", "actinide", 247, "solid", [2, 8, 18, 32, 25, 9, 2], 2, [3], 1.28, "#d946ef"),
    (97, "Bk", "Berkelium", None, 7, "f", "actinide", 247, "solid", [2, 8, 18, 32, 27, 8, 2], 2, [3, 4], 1.3, "#d946ef"),
    (98, "Cf", "Californium", None, 7, "f", "actinide", 251, "solid", [2, 8, 18, 32, 28, 8, 2], 2, [3], 1.3, "#d946ef"),
    (99, "Es", "Einsteinium", None, 7, "f", "actinide", 252, "solid", [2, 8, 18, 32, 29, 8, 2], 2, [3], 1.3, "#d946ef"),
    (100, "Fm", "Fermium", None, 7, "f", "actinide", 257, "solid", [2, 8, 18, 32, 30, 8, 2], 2, [2, 3], 1.3, "#d946ef"),
    (101, "Md", "Mendelevium", None, 7, "f", "actinide", 258, "solid", [2, 8, 18, 32, 31, 8, 2], 2, [2, 3], 1.3, "#d946ef"),
    (102, "No", "Nobelium", None, 7, "f", "actinide", 259, "solid", [2, 8, 18, 32, 32, 8, 2], 2, [2, 3], 1.3, "#d946ef"),
    (103, "Lr", "Lawrencium", None, 7, "f", "actinide", 266, "solid", [2, 8, 18, 32, 32, 8, 3], 3, [3], 1.3, "#d946ef"),
    (104, "Rf", "Rutherfordium", 4, 7, "d", "transition-metal", 267, "solid", [2, 8, 18, 32, 32, 10, 2], 2, [4], None, "#f59e0b"),
    (105, "Db", "Dubnium", 5, 7, "d", "transition-metal", 268, "solid", [2, 8, 18, 32, 32, 11, 2], 2, [5], None, "#f59e0b"),
    (106, "Sg", "Seaborgium", 6, 7, "d", "transition-metal", 269, "solid", [2, 8, 18, 32, 32, 12, 2], 2, [6], None, "#f59e0b"),
    (107, "Bh", "Bohrium", 7, 7, "d", "transition-metal", 270, "solid", [2, 8, 18, 32, 32, 13, 2], 2, [7], None, "#f59e0b"),
    (108, "Hs", "Hassium", 8, 7, "d", "transition-metal", 269, "solid", [2, 8, 18, 32, 32, 14, 2], 2, [8], None, "#f59e0b"),
    (109, "Mt", "Meitnerium", 9, 7, "d", "transition-metal", 278, "solid", [2, 8, 18, 32, 32, 15, 2], 2, [], None, "#94a3b8"),
    (110, "Ds", "Darmstadtium", 10, 7, "d", "transition-metal", 281, "solid", [2, 8, 18, 32, 32, 16, 2], 2, [], None, "#94a3b8"),
    (111, "Rg", "Roentgenium", 11, 7, "d", "transition-metal", 282, "solid", [2, 8, 18, 32, 32, 17, 2], 2, [], None, "#94a3b8"),
    (112, "Cn", "Copernicium", 12, 7, "d", "transition-metal", 285, "solid", [2, 8, 18, 32, 32, 18, 2], 2, [], None, "#94a3b8"),
    (113, "Nh", "Nihonium", 13, 7, "p", "post-transition-metal", 286, "solid", [2, 8, 18, 32, 32, 18, 3], 3, [], None, "#a8a29e"),
    (114, "Fl", "Flerovium", 14, 7, "p", "post-transition-metal", 289, "solid", [2, 8, 18, 32, 32, 18, 4], 4, [], None, "#a8a29e"),
    (115, "Mc", "Moscovium", 15, 7, "p", "post-transition-metal", 290, "solid", [2, 8, 18, 32, 32, 18, 5], 5, [], None, "#a8a29e"),
    (116, "Lv", "Livermorium", 16, 7, "p", "post-transition-metal", 293, "solid", [2, 8, 18, 32, 32, 18, 6], 6, [], None, "#a8a29e"),
    (117, "Ts", "Tennessine", 17, 7, "p", "halogen", 294, "solid", [2, 8, 18, 32, 32, 18, 7], 7, [], None, "#8b5cf6"),
    (118, "Og", "Oganesson", 18, 7, "p", "noble-gas", 294, "gas", [2, 8, 18, 32, 32, 18, 8], 8, [0], None, "#06b6d4"),
]

def main():
    elements = []
    for data in elements_data:
        an, sym, name, group, period, block, category, weight, state, shell_occ, valence, ox_states, eneg, color = data
        
        element = {
            "atomicNumber": an,
            "symbol": sym,
            "name": name,
            "group": group,
            "period": period,
            "block": block,
            "category": category,
            "standardAtomicWeight": weight,
            "stateAtStp": state,
            "shellOccupancy": shell_occ,
            "valenceElectronsMainGroup": valence,
            "commonOxidationStates": ox_states,
            "electronegativityPauling": eneg,
            "colorToken": color,
            "iconAsset": None,
            "unlockWorld": "encyclopedia",
            "factCardKey": f"fact_{sym.lower()}",
            "sourceRef": "NIST/IUPAC"
        }
        elements.append(element)
    
    output_path = "public/data/elements.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(elements, f, indent=2, ensure_ascii=False)
    
    print(f"Generated {len(elements)} elements to {output_path}")

if __name__ == "__main__":
    main()
