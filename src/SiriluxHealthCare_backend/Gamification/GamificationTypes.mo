import Nat "mo:base/Nat";
import CandyTypesLib "mo:candy_0_3_0/types";
module {
    // Avatar Types grouped by primary attributes
    public type AvatarType = {
        // Energy-focused avatars
        #FitnessChampion; // High energy bonus
        #MetabolicMaestro; // High energy bonus
        #StressBuster; // High energy bonus

        // Focus-focused avatars
        #MindfulnessMaster; // High focus bonus
        #PosturePro; // High focus bonus
        #SleepOptimizer; // High focus bonus

        // Vitality-focused avatars
        #NutritionExpert; // High vitality bonus
        #ImmuneGuardian; // High vitality bonus
        #AgingGracefully; // High vitality bonus

        // Resilience-focused avatars
        #HolisticHealer; // High resilience bonus
        #RecoveryWarrior; // High resilience bonus
        #ChronicCareChampion; // High resilience bonus
    };

    // Professional specializations grouped by primary attribute focus
    public type ProfessionalSpecialization = {
        // Energy-focused professionals
        #PhysicalTrainer; // Energy specialist
        #SportsMedicineExpert; // Energy specialist
        #FitnessInstructor; // Energy specialist

        // Focus-focused professionals
        #MentalHealthExpert; // Focus specialist
        #MeditationGuide; // Focus specialist
        #CognitiveBehaviorist; // Focus specialist

        // Vitality-focused professionals
        #NutritionalAdvisor; // Vitality specialist
        #FunctionalMedicineExpert; // Vitality specialist
        #PreventiveCareSpecialist; // Vitality specialist

        // Resilience-focused professionals
        #RehabilitationTherapist; // Resilience specialist
        #ChronicCareSpecialist; // Resilience specialist
        #RecoveryExpert; // Resilience specialist
    };

    // Facility services grouped by primary attribute focus
    public type FacilityServices = {
        // Energy-focused facilities
        #FitnessCenter; // Energy enhancement
        #SportsMedicineFacility; // Energy enhancement
        #AthleticTrainingCenter; // Energy enhancement

        // Focus-focused facilities
        #MentalHealthClinic; // Focus enhancement
        #MeditationCenter; // Focus enhancement
        #CognitiveCareCenter; // Focus enhancement

        // Vitality-focused facilities
        #NutritionCenter; // Vitality enhancement
        #WellnessRetreat; // Vitality enhancement
        #PreventiveHealthCenter; // Vitality enhancement

        // Resilience-focused facilities
        #RehabilitationHospital; // Resilience enhancement
        #RecoveryCenter; // Resilience enhancement
        #ChronicCareClinic; // Resilience enhancement
    };

    public type AvatarAttributes = {
        energy : Nat;
        focus : Nat;
        vitality : Nat;
        resilience : Nat;
        quality : Text;
        avatarType : Text;
        HP : Nat;
        visitCount : Nat;
        level : Nat;
    };

    public type ProfessionalAttributes = {
        experience : Nat;
        reputation : Nat;
        specialization : Text;
        quality : Text;
        HP : Nat;
        visitCount : Nat;
        level : Nat;

    };

    public type FacilityAttributes = {
        technologyLevel : Nat;
        reputation : Nat;
        services : Text;
        quality : Text;
        HP : Nat;
        visitCount : Nat;
        level : Nat;
    };

    public type Quality = {
        #Common;
        #Uncommon;
        #Rare;
        #Epic;
        #Legendary;
        #Mythic;
    };

    // Quality upgrade costs in tokens
    public let qualityUpgradeCosts : [(Quality, Nat)] = [
        (#Common, 1000),
        (#Uncommon, 2500),
        (#Rare, 5000),
        (#Epic, 10000),
        (#Legendary, 25000),
    ];

    // Get upgrade cost for current quality
    public func getUpgradeCost(currentQuality : Quality) : Nat {
        switch (currentQuality) {
            case (#Common) 1000;
            case (#Uncommon) 2500;
            case (#Rare) 5000;
            case (#Epic) 10000;
            case (#Legendary) 25000;
            case (#Mythic) 0; // Mythic is highest level
        };
    };

    // Attribute increments per quality level (percentage of base attributes)
    public func getAttributeIncrement(quality : Quality) : Float {
        switch (quality) {
            case (#Common) 0.0;
            case (#Uncommon) 0.10;
            case (#Rare) 0.25;
            case (#Epic) 0.50;
            case (#Legendary) 0.75;
            case (#Mythic) 1.0;
        };
    };

    // Default avatar attributes
    public func defaultAttributes(avatarType : AvatarType) : AvatarAttributes {
        {
            energy = switch (avatarType) {
                case (#FitnessChampion or #MetabolicMaestro or #StressBuster) 120;
                case _ 100;
            };
            focus = switch (avatarType) {
                case (#MindfulnessMaster or #PosturePro or #SleepOptimizer) 120;
                case _ 100;
            };
            vitality = switch (avatarType) {
                case (#NutritionExpert or #ImmuneGuardian or #AgingGracefully) 120;
                case _ 100;
            };
            resilience = switch (avatarType) {
                case (#HolisticHealer or #RecoveryWarrior or #ChronicCareChampion) 120;
                case _ 100;
            };
            quality = "Common";
            avatarType = switch (avatarType) {
                case (#FitnessChampion) "Fitness Champion";
                case (#MetabolicMaestro) "Metabolic Maestro";
                case (#StressBuster) "Stress Buster";
                case (#MindfulnessMaster) "Mindfulness Master";
                case (#PosturePro) "Posture Pro";
                case (#SleepOptimizer) "Sleep Optimizer";
                case (#NutritionExpert) "Nutrition Expert";
                case (#ImmuneGuardian) "Immune Guardian";
                case (#AgingGracefully) "Aging Gracefully";
                case (#HolisticHealer) "Holistic Healer";
                case (#RecoveryWarrior) "Recovery Warrior";
                case (#ChronicCareChampion) "Chronic Care Champion";
            };
            HP = 100;
            level = 1;
            visitCount = 0;
        };
    };

    // Default professional attributes
    public func defaultProfessionalAttributes(specialization : ProfessionalSpecialization) : ProfessionalAttributes {
        {
            experience = 10;
            reputation = 100;
            visitCount = 0;
            HP = 100;
            quality = "Common";
            specialization = switch (specialization) {
                case (#PhysicalTrainer) "Physical Trainer";
                case (#SportsMedicineExpert) "Sports Medicine Expert";
                case (#FitnessInstructor) "Fitness Instructor";
                case (#MentalHealthExpert) "Mental Health Expert";
                case (#MeditationGuide) "Meditation Guide";
                case (#CognitiveBehaviorist) "Cognitive Behaviorist";
                case (#NutritionalAdvisor) "Nutritional Advisor";
                case (#FunctionalMedicineExpert) "Functional Medicine Expert";
                case (#PreventiveCareSpecialist) "Preventive Care Specialist";
                case (#RehabilitationTherapist) "Rehabilitation Therapist";
                case (#ChronicCareSpecialist) "Chronic Care Specialist";
                case (#RecoveryExpert) "Recovery Expert";
            };
            level = 1;
        };
    };

    public func defaultFacilityAttributes(services : FacilityServices) : FacilityAttributes {
        {
            technologyLevel = 10;
            reputation = 100;
            services = switch (services) {
                case (#FitnessCenter) "Fitness Center";
                case (#SportsMedicineFacility) "Sports Medicine Facility";
                case (#AthleticTrainingCenter) "Athletic Training Center";
                case (#MentalHealthClinic) "Mental Health Clinic";
                case (#MeditationCenter) "Meditation Center";
                case (#CognitiveCareCenter) "Cognitive Care Center";
                case (#NutritionCenter) "Nutrition Center";
                case (#WellnessRetreat) "Wellness Retreat";
                case (#PreventiveHealthCenter) "Preventive Health Center";
                case (#RehabilitationHospital) "Rehabilitation Hospital";
                case (#RecoveryCenter) "Recovery Center";
                case (#ChronicCareClinic) "Chronic Care Clinic";
            };
            quality = "Common";
            HP = 100;
            level = 1;
            visitCount = 0;
        };
    };

    // Helper function to create default metadata for Avatar
    public func createAvatarDefaultMetadata(tokenId : Nat, attributes : AvatarAttributes, imageURL : Text) : CandyTypesLib.CandyShared {
        #Class([
            {
                immutable = false;
                name = "name";
                value = #Text("Wellness Avatar #" # Nat.toText(tokenId));
            },
            {
                immutable = false;
                name = "description";
                value = #Text("A " # attributes.avatarType # " Avatar in the Sirilux HealthCare ecosystem");
            },
            {
                immutable = false;
                name = "image";
                value = #Text(imageURL);
            },
            {
                immutable = false;
                name = "attributes";
                value = #Class([
                    {
                        immutable = false;
                        name = "energy";
                        value = #Nat(attributes.energy);
                    },
                    {
                        immutable = false;
                        name = "focus";
                        value = #Nat(attributes.focus);
                    },
                    {
                        immutable = false;
                        name = "vitality";
                        value = #Nat(attributes.vitality);
                    },
                    {
                        immutable = false;
                        name = "resilience";
                        value = #Nat(attributes.resilience);
                    },
                    {
                        immutable = false;
                        name = "quality";
                        value = #Text(attributes.quality);
                    },
                    {
                        immutable = false;
                        name = "avatarType";
                        value = #Text(attributes.avatarType);
                    },
                    {
                        immutable = false;
                        name = "HP";
                        value = #Nat(attributes.HP);
                    },
                    {
                        immutable = false;
                        name = "visitCount";
                        value = #Nat(attributes.visitCount);
                    },
                    {
                        immutable = false;
                        name = "level";
                        value = #Nat(attributes.level);
                    },
                ]);
            },
        ]);
    };

    // Helper function to create default metadata for Professional
    public func createProfessionalDefaultMetadata(tokenId : Nat, attributes : ProfessionalAttributes, imageURL : Text) : CandyTypesLib.CandyShared {
        #Class([
            {
                immutable = false;
                name = "name";
                value = #Text("Healthcare Professional #" # Nat.toText(tokenId));
            },
            {
                immutable = false;
                name = "description";
                value = #Text("A " # attributes.specialization # " in the Sirilux HealthCare ecosystem");
            },
            {
                immutable = false;
                name = "image";
                value = #Text(imageURL);
            },
            {
                immutable = false;
                name = "attributes";
                value = #Class([
                    {
                        immutable = false;
                        name = "experience";
                        value = #Nat(attributes.experience);
                    },
                    {
                        immutable = false;
                        name = "reputation";
                        value = #Nat(attributes.reputation);
                    },
                    {
                        immutable = false;
                        name = "specialization";
                        value = #Text(attributes.specialization);
                    },
                    {
                        immutable = false;
                        name = "quality";
                        value = #Text(attributes.quality);
                    },
                    {
                        immutable = false;
                        name = "HP";
                        value = #Nat(attributes.HP);
                    },
                    {
                        immutable = false;
                        name = "visitCount";
                        value = #Nat(attributes.visitCount);
                    },
                    {
                        immutable = false;
                        name = "level";
                        value = #Nat(attributes.level);
                    },
                ]);
            },
        ]);
    };

    // Helper function to create default metadata for Facility
    public func createFacilityDefaultMetadata(tokenId : Nat, attributes : FacilityAttributes, imageURL : Text) : CandyTypesLib.CandyShared {
        #Class([
            {
                immutable = false;
                name = "name";
                value = #Text("Healthcare Facility #" # Nat.toText(tokenId));
            },
            {
                immutable = false;
                name = "description";
                value = #Text("A " # attributes.services # " in the Sirilux HealthCare ecosystem");
            },
            {
                immutable = false;
                name = "image";
                value = #Text(imageURL);
            },
            {
                immutable = false;
                name = "attributes";
                value = #Class([
                    {
                        immutable = false;
                        name = "technologyLevel";
                        value = #Nat(attributes.technologyLevel);
                    },
                    {
                        immutable = false;
                        name = "reputation";
                        value = #Nat(attributes.reputation);
                    },
                    {
                        immutable = false;
                        name = "services";
                        value = #Text(attributes.services);
                    },
                    {
                        immutable = false;
                        name = "quality";
                        value = #Text(attributes.quality);
                    },
                    {
                        immutable = false;
                        name = "HP";
                        value = #Nat(attributes.HP);
                    },
                    {
                        immutable = false;
                        name = "visitCount";
                        value = #Nat(attributes.visitCount);
                    },
                    {
                        immutable = false;
                        name = "level";
                        value = #Nat(attributes.level);
                    },
                ]);
            },
        ]);
    };

};
