import Nat "mo:base/Nat";
import Time "mo:base/Time";
import CandyTypesLib "mo:candy_0_3_0/types";

module {

    public type VisitTimeStamps = {
        slotTime : ?Time.Time;
        bookingTime : ?Time.Time;
        completionTime : ?Time.Time;
        cancellationTime : ?Time.Time;
        rejectionTime : ?Time.Time;
    };

    public type VisitMode = {
        #Online;
        #Offline;
    };

    // Status of a visit
    public type VisitStatus = {
        #Pending; // booking initiated
        #Approved; // optional extra stage
        #Completed;
        #Cancelled;
        #Rejected;
    };

    // Represents an individual booking/visit
    public type Visit = {
        visitId : Nat;
        userId : Text; // the user who is booking
        professionalId : ?Text; // if visiting a professional
        facilityId : ?Text; // if visiting a facility
        visitMode : VisitMode;
        status : VisitStatus;
        timestamp : VisitTimeStamps;
        payment : VisitPrice;
        avatarId : Nat;
        meetingLink : ?Text; // Added field for online meetings
    };

    // Basic info for a professional (without slots)
    public type ProfessionalInfo = {
        id : Text;
        name : Text;
        specialization : Text;
        description : Text;
    };

    // Basic info for a facility (without slots)
    public type FacilityInfo = {
        id : Text;
        name : Text;
        facilityType : Text;
        description : Text;
    };

    // A single time block with capacity
    public type AvailabilitySlot = {
        entityId : Text; // professional or facility ID
        start : Time.Time;
        capacity : Nat;
        price : VisitPrice;
    };

    public type VisitPrice = Nat;
    public type BookedSlot = {
        entityId : Text; // professional or facility ID
        start : Time.Time;
        visitId : Nat;
        capacity : Nat;
    };

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

    // Helper function to get default image URL for Avatar types
    public func getAvatarImageURL(avatarType : AvatarType) : Text {
        switch (avatarType) {
            // Energy-focused avatars
            case (#FitnessChampion) "https://gateway.lighthouse.storage/ipfs/bafkreiewezorjawfvdy57upgea5pbazdv7abvhkyqny5bdkangaovip23u";
            case (#MetabolicMaestro) "https://gateway.lighthouse.storage/ipfs/bafkreiahak56opnjpcjcqj3gcme7temijd66g5jpjjukixvsjno2kseszu";
            case (#StressBuster) "https://gateway.lighthouse.storage/ipfs/bafkreiapeeri6gifrfad3n7skecmafiykteuctzzkqd7rhu4ogluorcdiy";

            // Focus-focused avatars
            case (#MindfulnessMaster) "https://gateway.lighthouse.storage/ipfs/bafkreicltg77gjnfbsd4oglujhoetssm3rxz52kfrn4uxdxza4cdyqs2qy";
            case (#PosturePro) "https://gateway.lighthouse.storage/ipfs/bafkreifwq6p7xhrcfexyavtfbijs356bglfdjdznkinjkv6bvfvss7rrjq";
            case (#SleepOptimizer) "https://gateway.lighthouse.storage/ipfs/bafkreia4c5g4pn542te2hzt63x7vbxbwlto5mmk4w4rwr7hy7oq3fxng44";

            // Vitality-focused avatars
            case (#NutritionExpert) "https://gateway.lighthouse.storage/ipfs/bafkreidoq7gs3ib7ddar46gz2yowrlvuzce5uojwwfo2s5nyom4ygcmwuq";
            case (#ImmuneGuardian) "https://gateway.lighthouse.storage/ipfs/bafkreihipoewmrsggqh2p2xrvjyqv5jslxn5jjx72wm5q6z76ji4rib3pe";
            case (#AgingGracefully) "https://gateway.lighthouse.storage/ipfs/bafkreigr32fgzqmyzsofpcux4b3miv5uweopbbz42vb35fflofj4i7gb4a";

            // Resilience-focused avatars
            case (#HolisticHealer) "https://gateway.lighthouse.storage/ipfs/bafkreiff2z2ogqazgx5s4zltopm6y7oakmoxceqzqpigq3nn3p24abvp6q";
            case (#RecoveryWarrior) "https://gateway.lighthouse.storage/ipfs/bafkreifce2jye7dwksjie27zvm4izvcj723tqfmjtx4vtoicqdflidihb4";
            case (#ChronicCareChampion) "https://gateway.lighthouse.storage/ipfs/bafkreic5m32he2yulurw45pwlxmhe2vpvct4z6xavn2viptwsi5jzexym4";
        };
    };

    // Helper function to get default image URL for Professional specializations
    public func getProfessionalImageURL(specialization : ProfessionalSpecialization) : Text {
        switch (specialization) {
            // Energy-focused professionals
            case (#PhysicalTrainer) "https://gateway.lighthouse.storage/ipfs/bafkreidawfxlmhecmdtcpqfwfs3daous2b7zjnx2we55l77ege6l75bzrm";
            case (#SportsMedicineExpert) "https://gateway.lighthouse.storage/ipfs/bafkreieey25yk4laryxkrmveklfcdvvabtfunxgo7cgavanezdo6vnfefy";
            case (#FitnessInstructor) "https://gateway.lighthouse.storage/ipfs/bafkreibibedzp2gzco33wdctw7u3tliq7tatmcve7aokokbuaje7up5fgy";

            // Focus-focused professionals
            case (#MentalHealthExpert) "https://gateway.lighthouse.storage/ipfs/bafkreihaax3keu3ojes3rciil66ha2nwia77t2sjtl326p7lexpebjnl5m";
            case (#MeditationGuide) "https://gateway.lighthouse.storage/ipfs/bafkreicys22xnkfwiqjzaij5r3yfnzx3iardhlscs7kf6qooqgbtd5ex7q";
            case (#CognitiveBehaviorist) "https://gateway.lighthouse.storage/ipfs/bafkreibaazatemrqlevlj7vtwz367im6gesxpuoionkqqdve25andqsil4";

            // Vitality-focused professionals
            case (#NutritionalAdvisor) "https://gateway.lighthouse.storage/ipfs/bafkreihc62uzsvjivkypqpdry6p6f3fue2rp3mzya6kt6ieqwettrzjrg4";
            case (#FunctionalMedicineExpert) "https://gateway.lighthouse.storage/ipfs/bafkreiegloypyv5vrhqudmbvnlfuzvl7tr4nmih6akgfscrduqsqarwp6q";
            case (#PreventiveCareSpecialist) "https://gateway.lighthouse.storage/ipfs/bafkreicycbt56vd4wtcrhdp3kc3bkme3mfvcbypvfdjaidvsonjlkm67ii";

            // Resilience-focused professionals
            case (#RehabilitationTherapist) "https://gateway.lighthouse.storage/ipfs/bafkreicml77brda47nzhgmommfp572u22d64jvasi4e2lgj5qugeoosvxe";
            case (#ChronicCareSpecialist) "https://gateway.lighthouse.storage/ipfs/bafkreifufdemtjo6r3xwdhctlawjjugo7ebvnn6l43fpaggu4h63hsdxua";
            case (#RecoveryExpert) "https://gateway.lighthouse.storage/ipfs/bafkreidib3fl2jf4kcwnrnextydwdbhbgmhl5jzn5pn4e477ze42czv76y";
        };
    };

    // Helper function to get default image URL for Facility services
    public func getFacilityImageURL(services : FacilityServices) : Text {
        switch (services) {
            // Energy-focused facilities
            case (#FitnessCenter) "https://gateway.lighthouse.storage/ipfs/bafkreihkuhmrwziltq7lohnbdgxdl7kc5aaiswvwut6zw2nv6h3xbafvfq";
            case (#SportsMedicineFacility) "https://gateway.lighthouse.storage/ipfs/bafkreid4detbmswupi6mtcdc4lobbib5hictue6427heu5a7fxtfwnoyti";
            case (#AthleticTrainingCenter) "https://gateway.lighthouse.storage/ipfs/bafkreiciano5umt6epzfbx66tfzbzbqxnh36ushnwj4iflzo3emoh4glqy";

            // Focus-focused facilities
            case (#MentalHealthClinic) "https://gateway.lighthouse.storage/ipfs/bafkreibq773itck2wcfosxp44t42mfwvsz6wijhhb7a3qkhevl2uerl6pe";
            case (#MeditationCenter) "https://gateway.lighthouse.storage/ipfs/bafkreibsceqbccykkw5a5yx45sow5cnzw5v3oafxxkjuhprks2ymru2p5e";
            case (#CognitiveCareCenter) "https://gateway.lighthouse.storage/ipfs/bafkreidu5vg36hsixuwgilnclcpc5hpvhxfhclbfpxflb6pnbaug5vtvte";

            // Vitality-focused facilities
            case (#NutritionCenter) "https://gateway.lighthouse.storage/ipfs/bafkreieasr2vjvnudyaabuyao47q7s6ue5e7kyg2cn3i66wsib7vrmvc3m";
            case (#WellnessRetreat) "https://gateway.lighthouse.storage/ipfs/bafkreigotqhidajlayz37qfgcw4arexn275vg2gg6kukdpaprxt3phv764";
            case (#PreventiveHealthCenter) "https://gateway.lighthouse.storage/ipfs/bafkreiazdcjb5jsichjkfgvg4tilktclyjfvvps762vdpqld4zpsbbibjy";

            // Resilience-focused facilities
            case (#RehabilitationHospital) "https://gateway.lighthouse.storage/ipfs/bafkreidxc7teeckoc442jlrmvz5p72n47qojtxsnuioigq7lbavw3kq4py";
            case (#RecoveryCenter) "https://gateway.lighthouse.storage/ipfs/bafkreidy3udhvun5z7z6tc4ezhsgxhzszlnskz5smuyutmrvf56sxjlane";
            case (#ChronicCareClinic) "https://gateway.lighthouse.storage/ipfs/bafkreibxt4zhuskcpx3oclpuaza5snmcfyphj37n4dpjufgy4dpcqzsrfu";
        };
    };

};
