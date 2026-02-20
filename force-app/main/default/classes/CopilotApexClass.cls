public class CopilotApexClass {
   @AuraEnabled(cacheable=true)
    public static List<case> getCases() {
        return [SELECT Id, Subject, Status FROM Case];
    }
    
    @AuraEnabled
    public static void updateCases(String caseId, String newStatus) {
        Case c = new Case(Id = caseId, Status = newStatus);
        update c;
    }
    
    @AuraEnabled
    public static void deleteCases(String caseId) {
        delete [SELECT Id FROM Case WHERE Id = :caseId];
    }
    /**
 * Accepts opportunity id and returns opportunity from the query
 * with all required fields.
 */

 
   
}